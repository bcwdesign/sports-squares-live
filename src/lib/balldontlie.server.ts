// Server-only helpers for the BALLDONTLIE NBA live score integration.
// The .server.ts extension is enforced by TanStack's import-protection
// plugin: any client-side import of this file fails the build. Safe to
// hold supabaseAdmin + secret API key reads here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { NormalizedLiveGame } from "./balldontlie.types";

const BALLDONTLIE_BASE = "https://api.balldontlie.io/v1";

// In-memory min-interval guard: gameId -> last successful sync timestamp.
// Cleared on Worker recycle. Best-effort, not distributed.
const lastSyncByGame = new Map<string, number>();
const MIN_SYNC_INTERVAL_MS = 5_000;

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: "no_key" | "rate_limited" | "unavailable" | "no_live_games" };

export async function callBalldontlieLive(): Promise<FetchResult<NormalizedLiveGame[]>> {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return { ok: false, code: "no_key", error: "BALLDONTLIE_API_KEY is not configured on the server." };
  }

  let res: Response;
  try {
    res = await fetch(`${BALLDONTLIE_BASE}/box_scores/live`, {
      method: "GET",
      headers: { Authorization: apiKey },
    });
  } catch (e) {
    console.error("BALLDONTLIE network error:", e);
    return { ok: false, code: "unavailable", error: "Could not reach the BALLDONTLIE API." };
  }

  if (res.status === 429) {
    return { ok: false, code: "rate_limited", error: "BALLDONTLIE rate limit reached. Try again shortly." };
  }
  if (!res.ok) {
    return { ok: false, code: "unavailable", error: `BALLDONTLIE returned HTTP ${res.status}.` };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, code: "unavailable", error: "BALLDONTLIE returned invalid JSON." };
  }

  const root = payload as { data?: unknown[] } | null;
  const list = Array.isArray(root?.data) ? root!.data! : [];
  const normalized: NormalizedLiveGame[] = list
    .map((item) => normalizeBoxScore(item))
    .filter((g): g is NormalizedLiveGame => g !== null);

  if (normalized.length === 0) {
    return { ok: false, code: "no_live_games", error: "No live NBA games right now." };
  }
  return { ok: true, data: normalized };
}

function normalizeBoxScore(item: unknown): NormalizedLiveGame | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const home = (obj.home_team ?? null) as Record<string, unknown> | null;
  const away = (obj.visitor_team ?? obj.away_team ?? null) as Record<string, unknown> | null;
  if (!home || !away) return null;

  const id = obj.id;
  const externalId = id !== undefined && id !== null ? String(id) : null;
  if (!externalId) return null;

  const homeId = home.id !== undefined && home.id !== null ? String(home.id) : "";
  const awayId = away.id !== undefined && away.id !== null ? String(away.id) : "";

  const period = typeof obj.period === "number" ? obj.period : null;
  const gameClock =
    typeof obj.time === "string"
      ? obj.time
      : typeof obj.clock === "string"
        ? obj.clock
        : null;
  const gameStatus =
    typeof obj.status === "string"
      ? obj.status
      : typeof obj.game_status === "string"
        ? obj.game_status
        : null;

  return {
    external_game_id: externalId,
    home_team_id: homeId,
    home_team_name: String(home.full_name ?? home.name ?? ""),
    home_team_abbreviation: String(home.abbreviation ?? ""),
    away_team_id: awayId,
    away_team_name: String(away.full_name ?? away.name ?? ""),
    away_team_abbreviation: String(away.abbreviation ?? ""),
    home_score: typeof obj.home_team_score === "number" ? obj.home_team_score : 0,
    away_score:
      typeof obj.visitor_team_score === "number"
        ? obj.visitor_team_score
        : typeof obj.away_team_score === "number"
          ? obj.away_team_score
          : 0,
    period,
    game_clock: gameClock,
    game_status: gameStatus,
  };
}

export async function runSync(
  gameId: string,
  source: "host" | "cron" | "manual" = "host",
): Promise<{
  synced: boolean;
  reason?: string;
  home_score?: number;
  away_score?: number;
  period?: number | null;
  game_clock?: string | null;
  game_status?: string | null;
}> {
  const now = Date.now();
  const last = lastSyncByGame.get(gameId) ?? 0;
  if (now - last < MIN_SYNC_INTERVAL_MS) {
    return { synced: false, reason: "Skipped — synced very recently." };
  }

  const { data: g, error: gErr } = await supabaseAdmin
    .from("games")
    .select(
      "id, external_provider, external_game_id, period, home_score, away_score, home_team, away_team, external_home_team_id, external_away_team_id, external_home_team_name, external_away_team_name",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (gErr || !g) {
    return { synced: false, reason: "Game not found." };
  }
  if (g.external_provider !== "balldontlie" || !g.external_game_id) {
    return { synced: false, reason: "No live provider connected." };
  }

  const result = await callBalldontlieLive();
  if (!result.ok) {
    await supabaseAdmin
      .from("games")
      .update({ last_score_sync_error: result.error, last_score_sync_at: new Date().toISOString() })
      .eq("id", gameId);
    return { synced: false, reason: result.error };
  }

  const match = result.data.find((x) => x.external_game_id === g.external_game_id);
  if (!match) {
    const msg = "No matching live game found upstream (it may have ended).";
    await supabaseAdmin
      .from("games")
      .update({ last_score_sync_error: msg, last_score_sync_at: new Date().toISOString() })
      .eq("id", gameId);
    return { synced: false, reason: msg };
  }

  const upstreamStatus = (match.game_status ?? "").toLowerCase();
  const completed = upstreamStatus.includes("final");

  // Home/Away orientation guard.
  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
  const localHome = norm(g.home_team);
  const localAway = norm(g.away_team);
  const upHomeId = String(match.home_team_id ?? "");
  const upAwayId = String(match.away_team_id ?? "");
  const upHomeName = norm(match.home_team_name);
  const upAwayName = norm(match.away_team_name);

  let swap = false;
  if (g.external_home_team_id && g.external_away_team_id) {
    if (g.external_home_team_id === upAwayId && g.external_away_team_id === upHomeId) {
      swap = true;
    }
  } else if (localHome && localAway) {
    const homeMatchesUpHome = upHomeName.includes(localHome) || localHome.includes(upHomeName);
    const homeMatchesUpAway = upAwayName.includes(localHome) || localHome.includes(upAwayName);
    const awayMatchesUpAway = upAwayName.includes(localAway) || localAway.includes(upAwayName);
    if (!homeMatchesUpHome && homeMatchesUpAway && awayMatchesUpAway) {
      swap = true;
    }
  }

  const finalHomeScore = swap ? match.away_score : match.home_score;
  const finalAwayScore = swap ? match.home_score : match.away_score;

  const { error: updErr } = await supabaseAdmin
    .from("games")
    .update({
      home_score: finalHomeScore,
      away_score: finalAwayScore,
      period: match.period,
      game_clock: match.game_clock,
      game_status: match.game_status,
      score_source: "api",
      last_score_sync_at: new Date().toISOString(),
      last_score_sync_error: null,
      ...(typeof match.period === "number" ? { quarter: match.period } : {}),
      ...(match.game_clock ? { clock: match.game_clock } : {}),
      ...(completed ? { status: "completed" as const } : { status: "live" as const }),
    })
    .eq("id", gameId);
  if (updErr) {
    return { synced: false, reason: "Failed to update game row." };
  }

  const changed =
    g.home_score !== finalHomeScore ||
    g.away_score !== finalAwayScore ||
    g.period !== match.period;

  if (changed) {
    console.log(
      `[score-sync] game=${gameId} src=${source} ${g.home_score}-${g.away_score} -> ${finalHomeScore}-${finalAwayScore} P${match.period ?? "?"} ${new Date().toISOString()}`,
    );
  } else {
    console.log(
      `[score-sync] game=${gameId} src=${source} no-op (${finalHomeScore}-${finalAwayScore}) ${new Date().toISOString()}`,
    );
  }

  if (changed) {
    await supabaseAdmin.from("score_events").insert([
      {
        game_id: gameId,
        provider: "balldontlie",
        external_game_id: g.external_game_id,
        home_score: finalHomeScore,
        away_score: finalAwayScore,
        period: match.period,
        game_clock: match.game_clock,
        game_status: match.game_status,
        score_source: "api",
        raw_payload: JSON.parse(JSON.stringify({ ...match, _orientation_swapped: swap })),
      },
    ]);
  }

  lastSyncByGame.set(gameId, Date.now());

  return {
    synced: true,
    home_score: finalHomeScore,
    away_score: finalAwayScore,
    period: match.period,
    game_clock: match.game_clock,
    game_status: match.game_status,
  };
}
