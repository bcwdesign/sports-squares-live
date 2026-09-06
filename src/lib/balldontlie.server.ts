// Server-only helpers for the BALLDONTLIE live score integration (NBA + NFL).
// The .server.ts extension is enforced by TanStack's import-protection
// plugin: any client-side import of this file fails the build. Safe to
// hold supabaseAdmin + secret API key reads here.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LiveGameState, NormalizedLiveGame, SportKey } from "./balldontlie.types";

const NBA_BASE = "https://api.balldontlie.io/v1";
const NFL_BASE = "https://api.balldontlie.io/nfl/v1";

// In-memory min-interval guard: gameId -> last successful sync timestamp.
// Cleared on Worker recycle. Best-effort, not distributed.
const lastSyncByGame = new Map<string, number>();
const MIN_SYNC_INTERVAL_MS = 5_000;

// Prevents duplicate overlapping syncs for the same game within one worker.
const inFlight = new Set<string>();

type ErrorCode = "no_key" | "rate_limited" | "unavailable" | "no_live_games" | "unauthorized";

type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string; code: ErrorCode };

function nbaKey(): string | undefined {
  return process.env.BALLDONTLIE_API_KEY;
}

// The account may use one key across products, so fall back to the NBA key.
function nflKey(): string | undefined {
  return process.env.BALLDONTLIE_NFL_API_KEY || process.env.BALLDONTLIE_API_KEY;
}

/** Never echoes the key or upstream body — safe for user-facing messages. */
async function callProvider(url: string, apiKey: string): Promise<FetchResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Authorization: apiKey } });
  } catch (e) {
    console.error("BALLDONTLIE network error:", e instanceof Error ? e.message : "unknown");
    return { ok: false, code: "unavailable", error: "Could not reach the BALLDONTLIE API." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, code: "unauthorized", error: "BALLDONTLIE rejected the server credentials." };
  }
  if (res.status === 429) {
    return { ok: false, code: "rate_limited", error: "BALLDONTLIE rate limit reached. Try again in a minute." };
  }
  if (!res.ok) {
    return { ok: false, code: "unavailable", error: `BALLDONTLIE returned HTTP ${res.status}.` };
  }
  try {
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, code: "unavailable", error: "BALLDONTLIE returned invalid data." };
  }
}

// ============================================================================
// NBA
// ============================================================================

export async function callBalldontlieLive(): Promise<FetchResult<NormalizedLiveGame[]>> {
  const apiKey = nbaKey();
  if (!apiKey) {
    return { ok: false, code: "no_key", error: "The NBA score feed is not configured on the server." };
  }

  const result = await callProvider(`${NBA_BASE}/box_scores/live`, apiKey);
  if (!result.ok) return result;

  const root = result.data as { data?: unknown[] } | null;
  const list = Array.isArray(root?.data) ? root!.data! : [];
  const normalized = list
    .map((item) => normalizeNbaBoxScore(item))
    .filter((g): g is NormalizedLiveGame => g !== null);

  if (normalized.length === 0) {
    return { ok: false, code: "no_live_games", error: "No live NBA games right now." };
  }
  return { ok: true, data: normalized };
}

function normalizeNbaBoxScore(item: unknown): NormalizedLiveGame | null {
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
    typeof obj.time === "string" ? obj.time : typeof obj.clock === "string" ? obj.clock : null;
  const gameStatus =
    typeof obj.status === "string"
      ? obj.status
      : typeof obj.game_status === "string"
        ? obj.game_status
        : null;

  const lowered = (gameStatus ?? "").toLowerCase();
  const state: LiveGameState = lowered.includes("final")
    ? "final"
    : lowered.includes("scheduled") || lowered.includes("pre")
      ? "scheduled"
      : "in_progress";

  return {
    sport: "NBA",
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
    status_state: state,
    start_time: typeof obj.date === "string" ? obj.date : null,
  };
}

// ============================================================================
// NFL
// ============================================================================

const NFL_STATES: LiveGameState[] = [
  "scheduled",
  "in_progress",
  "final",
  "postponed",
  "canceled",
  "delayed",
  "suspended",
  "abandoned",
  "unknown",
];

function toState(raw: unknown, statusText: string): LiveGameState {
  const v = typeof raw === "string" ? raw.toLowerCase().trim().replace(/[\s-]+/g, "_") : "";
  const found = NFL_STATES.find((s) => s === v);
  if (found) return found;
  // Fall back to the free-form status only when status_state is absent.
  const t = statusText.toLowerCase();
  if (t.includes("final")) return "final";
  if (t.includes("postpon")) return "postponed";
  if (t.includes("cancel")) return "canceled";
  if (t.includes("suspend")) return "suspended";
  if (t.includes("delay")) return "delayed";
  if (/\d{1,2}:\d{2}/.test(t) || t.includes("quarter") || t.includes("halftime") || /\bq[1-5]\b/.test(t)) {
    return "in_progress";
  }
  if (t.includes("scheduled") || t.includes("pre")) return "scheduled";
  return "unknown";
}

/** Only accept a genuine MM:SS clock; never invent one. */
function extractClock(statusText: string): string | null {
  const m = statusText.match(/\b(\d{1,2}):([0-5]\d)\b/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * NFL period mapping: Q1→1, Q2/halftime→2, Q3→3, Q4→4, OT→5.
 * Final regulation ends at 4, final OT at 5. Null quarter fields are never
 * treated as a scored zero.
 */
export function nflPeriod(
  state: LiveGameState,
  statusText: string,
  quarters: { home: (number | null)[]; away: (number | null)[]; homeOt: number | null; awayOt: number | null },
): number | null {
  const t = statusText.toLowerCase();
  const hasOt = quarters.homeOt !== null || quarters.awayOt !== null || /\bot\b|overtime/.test(t);

  if (state === "final") return hasOt ? 5 : 4;
  if (state === "scheduled") return null;

  if (/\bot\b|overtime/.test(t)) return 5;
  if (t.includes("halftime") || t.includes("half time")) return 2;
  const qm = t.match(/\bq(?:tr)?\s*([1-4])\b/) ?? t.match(/\b([1-4])(?:st|nd|rd|th)\b/);
  if (qm) return Number(qm[1]);

  if (state === "in_progress") {
    // Fall back to the deepest quarter with a reported (non-null) score.
    let deepest = 0;
    for (let i = 0; i < 4; i++) {
      if (quarters.home[i] !== null || quarters.away[i] !== null) deepest = i + 1;
    }
    if (hasOt) return 5;
    return deepest > 0 ? deepest : 1;
  }
  return null;
}

export function normalizeNflGame(item: unknown): NormalizedLiveGame | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const home = (obj.home_team ?? null) as Record<string, unknown> | null;
  const away = (obj.visitor_team ?? obj.away_team ?? null) as Record<string, unknown> | null;
  if (!home || !away) return null;

  const id = obj.id;
  const externalId = id !== undefined && id !== null ? String(id) : null;
  if (!externalId) return null;

  const statusText = typeof obj.status === "string" ? obj.status : "";
  const state = toState(obj.status_state, statusText);

  const quarters = {
    home: [num(obj.home_team_q1), num(obj.home_team_q2), num(obj.home_team_q3), num(obj.home_team_q4)],
    away: [
      num(obj.visitor_team_q1),
      num(obj.visitor_team_q2),
      num(obj.visitor_team_q3),
      num(obj.visitor_team_q4),
    ],
    homeOt: num(obj.home_team_ot),
    awayOt: num(obj.visitor_team_ot),
  };

  return {
    sport: "NFL",
    external_game_id: externalId,
    home_team_id: home.id !== undefined && home.id !== null ? String(home.id) : "",
    home_team_name: String(home.full_name ?? home.name ?? ""),
    home_team_abbreviation: String(home.abbreviation ?? ""),
    away_team_id: away.id !== undefined && away.id !== null ? String(away.id) : "",
    away_team_name: String(away.full_name ?? away.name ?? ""),
    away_team_abbreviation: String(away.abbreviation ?? ""),
    home_score: num(obj.home_team_score) ?? 0,
    away_score: num(obj.visitor_team_score) ?? 0,
    period: nflPeriod(state, statusText, quarters),
    game_clock: state === "in_progress" ? extractClock(statusText) : null,
    game_status: statusText || null,
    status_state: state,
    start_time: typeof obj.date === "string" ? obj.date : null,
    week: num(obj.week),
    season: num(obj.season),
    postseason: obj.postseason === true,
    venue: typeof obj.venue === "string" ? obj.venue : null,
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Upcoming/current NFL games: today plus the next two weeks, all season
 * types. One filtered request per page — never a whole-season download.
 */
export async function fetchUpcomingNflSchedule(daysAhead = 14): Promise<FetchResult<NormalizedLiveGame[]>> {
  const apiKey = nflKey();
  if (!apiKey) {
    return { ok: false, code: "no_key", error: "The NFL score feed is not configured on the server." };
  }

  const params = new URLSearchParams();
  const today = new Date();
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    params.append("dates[]", isoDate(d));
  }
  for (const st of [1, 2, 3]) params.append("season_types[]", String(st));
  params.set("per_page", "100");

  const collected: NormalizedLiveGame[] = [];
  let cursor: string | null = null;
  // Cursor pagination, hard-capped so a bad response can't loop.
  for (let page = 0; page < 5; page++) {
    const url = `${NFL_BASE}/games?${params.toString()}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await callProvider(url, apiKey);
    if (!res.ok) return res;
    const root = res.data as { data?: unknown[]; meta?: { next_cursor?: unknown } } | null;
    const list = Array.isArray(root?.data) ? root!.data! : [];
    for (const item of list) {
      const g = normalizeNflGame(item);
      if (!g) continue;
      if (g.status_state === "canceled" || g.status_state === "abandoned") continue;
      collected.push(g);
    }
    const next = root?.meta?.next_cursor;
    cursor = next === undefined || next === null || next === "" ? null : String(next);
    if (!cursor) break;
  }

  collected.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  if (collected.length === 0) {
    return { ok: false, code: "no_live_games", error: "No NFL games scheduled in the next two weeks." };
  }
  return { ok: true, data: collected };
}

/** Fetch one exact NFL game by provider id. */
export async function fetchNflGameById(externalId: string): Promise<FetchResult<NormalizedLiveGame>> {
  const apiKey = nflKey();
  if (!apiKey) {
    return { ok: false, code: "no_key", error: "The NFL score feed is not configured on the server." };
  }
  const res = await callProvider(`${NFL_BASE}/games/${encodeURIComponent(externalId)}`, apiKey);
  if (!res.ok) return res;
  const root = res.data as { data?: unknown } | null;
  const g = normalizeNflGame(root?.data ?? root);
  if (!g) {
    return { ok: false, code: "no_live_games", error: "That NFL game is no longer available upstream." };
  }
  return { ok: true, data: g };
}

// ============================================================================
// Shared sync
// ============================================================================

export type SyncResult = {
  synced: boolean;
  reason?: string;
  home_score?: number;
  away_score?: number;
  period?: number | null;
  game_clock?: string | null;
  game_status?: string | null;
  status_state?: LiveGameState;
};

export async function runSync(
  gameId: string,
  source: "host" | "cron" | "manual" = "host",
): Promise<SyncResult> {
  const now = Date.now();
  const last = lastSyncByGame.get(gameId) ?? 0;
  if (now - last < MIN_SYNC_INTERVAL_MS) {
    return { synced: false, reason: "Skipped — synced very recently." };
  }
  if (inFlight.has(gameId)) {
    return { synced: false, reason: "Skipped — a sync is already running." };
  }
  inFlight.add(gameId);
  try {
    return await doSync(gameId, source);
  } finally {
    inFlight.delete(gameId);
  }
}

async function doSync(gameId: string, source: string): Promise<SyncResult> {
  const { data: g, error: gErr } = await supabaseAdmin
    .from("games")
    .select(
      "id, sport, external_provider, external_game_id, period, home_score, away_score, home_team, away_team, external_home_team_id, external_away_team_id, external_home_team_name, external_away_team_name",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (gErr || !g) {
    return { synced: false, reason: "Game not found." };
  }
  if (g.external_provider !== "balldontlie" || !g.external_game_id) {
    return { synced: false, reason: "No live provider connected." };
  }

  const sport: SportKey = (g.sport ?? "NBA").toUpperCase() === "NFL" ? "NFL" : "NBA";

  let match: NormalizedLiveGame | null = null;
  let failure: string | null = null;

  if (sport === "NFL") {
    const res = await fetchNflGameById(g.external_game_id);
    if (res.ok) match = res.data;
    else failure = res.error;
  } else {
    const res = await callBalldontlieLive();
    if (!res.ok) failure = res.error;
    else {
      match = res.data.find((x) => x.external_game_id === g.external_game_id) ?? null;
      if (!match) failure = "No matching live game found upstream (it may have ended).";
    }
  }

  if (!match) {
    await supabaseAdmin
      .from("games")
      .update({
        last_score_sync_error: failure ?? "Upstream game unavailable.",
        last_score_sync_at: new Date().toISOString(),
      })
      .eq("id", gameId);
    return { synced: false, reason: failure ?? "Upstream game unavailable." };
  }

  const completed = match.status_state === "final";

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
      // Only 'final' completes the game — postponed/delayed/suspended stay live.
      ...(completed
        ? { status: "completed" as const }
        : match.status_state === "in_progress"
          ? { status: "live" as const }
          : {}),
    })
    .eq("id", gameId);
  if (updErr) {
    return { synced: false, reason: "Failed to update game row." };
  }

  const changed =
    g.home_score !== finalHomeScore || g.away_score !== finalAwayScore || g.period !== match.period;

  console.log(
    `[score-sync] game=${gameId} sport=${sport} src=${source} ${changed ? `${g.home_score}-${g.away_score} -> ` : "no-op "}${finalHomeScore}-${finalAwayScore} P${match.period ?? "?"} state=${match.status_state} ${new Date().toISOString()}`,
  );

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
    status_state: match.status_state,
  };
}
