// Server functions for the BALLDONTLIE NBA live scoring integration.
//
// IMPORTANT — security model:
//   * BALLDONTLIE_API_KEY is read from process.env inside handlers ONLY.
//     It is never bundled into the client.
//   * All mutating functions are gated by `requireSupabaseAuth` and verify
//     the caller is the game host before touching any rows.
//   * supabaseAdmin is only used for the `score_events` insert and final
//     `games` update so we can write authoritative server-trusted values
//     even when RLS would otherwise scope the host's writes.
//
// Polling model (per spec):
//   The host's browser polls `syncGameScore` while on /game/:id/live. To
//   guard against multiple host tabs hammering the upstream API, we keep an
//   in-memory "last sync at" map per game and silently no-op if a sync
//   happened too recently. This is per-Worker-instance and best-effort, not
//   true distributed rate limiting.
//
// TODO(future): Move auto-sync to a scheduled pg_cron / external scheduler
// hitting a /api/public/* server route for venue-scale reliability so the
// host browser does not need to stay open.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BALLDONTLIE_BASE = "https://api.balldontlie.io/v1";

// In-memory min-interval guard: gameId -> last successful sync timestamp.
// Cleared on Worker recycle. Intentionally simple — see file header note.
const lastSyncByGame = new Map<string, number>();
const MIN_SYNC_INTERVAL_MS = 5_000;

// ---------- Types -----------------------------------------------------------

export type NormalizedLiveGame = {
  external_game_id: string;
  home_team_id: string;
  home_team_name: string;
  home_team_abbreviation: string;
  away_team_id: string;
  away_team_name: string;
  away_team_abbreviation: string;
  home_score: number;
  away_score: number;
  period: number | null;
  game_clock: string | null;
  game_status: string | null;
};

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: "no_key" | "rate_limited" | "unavailable" | "no_live_games" };

// ---------- BALLDONTLIE call (server-only) ----------------------------------

async function callBalldontlieLive(): Promise<FetchResult<NormalizedLiveGame[]>> {
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
    return {
      ok: false,
      code: "unavailable",
      error: `BALLDONTLIE returned HTTP ${res.status}.`,
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, code: "unavailable", error: "BALLDONTLIE returned invalid JSON." };
  }

  // Defensive shape parsing — BALLDONTLIE returns { data: [ box_score, ... ] }.
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

// ---------- Server functions ------------------------------------------------

// Fetch the current list of live NBA games for the host's "Connect" modal.
export const fetchLiveNbaGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const result = await callBalldontlieLive();
    if (!result.ok) {
      return { games: [] as NormalizedLiveGame[], error: result.error, code: result.code };
    }
    return { games: result.data, error: null, code: null };
  });

// Connect a ClutchSquares game to a BALLDONTLIE live game (host only).
export const connectLiveScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      gameId: z.string().uuid(),
      external_game_id: z.string().min(1).max(64),
      external_home_team_id: z.string().max(64).optional().nullable(),
      external_away_team_id: z.string().max(64).optional().nullable(),
      external_home_team_name: z.string().max(255).optional().nullable(),
      external_away_team_name: z.string().max(255).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify host via RLS-bound select.
    const { data: gameRow, error: gameErr } = await supabase
      .from("games")
      .select("id, host_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (gameErr) throw new Error("Failed to load game.");
    if (!gameRow) throw new Error("Game not found.");
    if (gameRow.host_id !== userId) throw new Error("Only the host can connect a live score feed.");

    const { error: updErr } = await supabase
      .from("games")
      .update({
        external_provider: "balldontlie",
        external_game_id: data.external_game_id,
        external_home_team_id: data.external_home_team_id ?? null,
        external_away_team_id: data.external_away_team_id ?? null,
        external_home_team_name: data.external_home_team_name ?? null,
        external_away_team_name: data.external_away_team_name ?? null,
        score_source: "api",
        auto_sync_enabled: true,
        last_score_sync_error: null,
      })
      .eq("id", data.gameId);
    if (updErr) throw new Error("Failed to save provider mapping.");

    // Kick off an immediate sync so the board reflects current score.
    const synced = await runSync(data.gameId);
    return { ok: true, sync: synced };
  });

// Disconnect the live feed (host only). Keeps mapping fields cleared.
export const disconnectLiveScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ gameId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: gameRow } = await supabase
      .from("games")
      .select("host_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!gameRow) throw new Error("Game not found.");
    if (gameRow.host_id !== userId) throw new Error("Only the host can disconnect.");

    const { error } = await supabase
      .from("games")
      .update({
        external_provider: null,
        external_game_id: null,
        external_home_team_id: null,
        external_away_team_id: null,
        external_home_team_name: null,
        external_away_team_name: null,
        auto_sync_enabled: false,
        score_source: "manual",
        last_score_sync_error: null,
      })
      .eq("id", data.gameId);
    if (error) throw new Error("Failed to disconnect.");
    return { ok: true };
  });

// Toggle auto-sync (host only).
export const setAutoSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ gameId: z.string().uuid(), enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: gameRow } = await supabase
      .from("games")
      .select("host_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!gameRow) throw new Error("Game not found.");
    if (gameRow.host_id !== userId) throw new Error("Only the host can toggle auto-sync.");

    const { error } = await supabase
      .from("games")
      .update({ auto_sync_enabled: data.enabled })
      .eq("id", data.gameId);
    if (error) throw new Error("Failed to update auto-sync.");
    return { ok: true };
  });

// Manual override (host only). Sets score_source = 'manual_override' but keeps
// the provider mapping intact so the host can resume API sync later.
export const manualScoreOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      gameId: z.string().uuid(),
      home_score: z.number().int().min(0).max(999),
      away_score: z.number().int().min(0).max(999),
      period: z.number().int().min(1).max(8).optional().nullable(),
      game_clock: z.string().max(16).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: gameRow } = await supabase
      .from("games")
      .select("host_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!gameRow) throw new Error("Game not found.");
    if (gameRow.host_id !== userId) throw new Error("Only the host can override the score.");

    const { error } = await supabase
      .from("games")
      .update({
        home_score: data.home_score,
        away_score: data.away_score,
        period: data.period ?? null,
        game_clock: data.game_clock ?? null,
        score_source: "manual_override",
        last_score_sync_error: null,
      })
      .eq("id", data.gameId);
    if (error) throw new Error("Failed to override score.");
    return { ok: true };
  });

// Sync a single game with BALLDONTLIE (host-triggered or scheduled).
export const syncGameScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ gameId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: gameRow } = await supabase
      .from("games")
      .select("host_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!gameRow) throw new Error("Game not found.");
    if (gameRow.host_id !== userId) throw new Error("Only the host can trigger a sync.");
    return runSync(data.gameId);
  });

// Internal sync routine — used by both manual sync and connect-then-sync.
async function runSync(gameId: string): Promise<{
  synced: boolean;
  reason?: string;
  home_score?: number;
  away_score?: number;
  period?: number | null;
  game_clock?: string | null;
  game_status?: string | null;
}> {
  // Min-interval guard (per-Worker-instance, best-effort).
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

  // Map upstream "Final" to our 'completed' status; live → 'live'; otherwise leave alone.
  const upstreamStatus = (match.game_status ?? "").toLowerCase();
  const completed = upstreamStatus.includes("final");

  const { error: updErr } = await supabaseAdmin
    .from("games")
    .update({
      home_score: match.home_score,
      away_score: match.away_score,
      period: match.period,
      game_clock: match.game_clock,
      game_status: match.game_status,
      score_source: "api",
      last_score_sync_at: new Date().toISOString(),
      last_score_sync_error: null,
      // Bridge to existing UI fields used by winner detection / overlay:
      ...(typeof match.period === "number" ? { quarter: match.period } : {}),
      ...(match.game_clock ? { clock: match.game_clock } : {}),
      ...(completed ? { status: "completed" as const } : { status: "live" as const }),
    })
    .eq("id", gameId);
  if (updErr) {
    return { synced: false, reason: "Failed to update game row." };
  }

  // Append-only audit log. Idempotency: if nothing changed, skip the insert
  // so we don't spam score_events with duplicate "no-op" rows.
  const changed =
    g.home_score !== match.home_score ||
    g.away_score !== match.away_score ||
    g.period !== match.period;

  if (changed) {
    await supabaseAdmin.from("score_events").insert([
      {
        game_id: gameId,
        provider: "balldontlie",
        external_game_id: g.external_game_id,
        home_score: match.home_score,
        away_score: match.away_score,
        period: match.period,
        game_clock: match.game_clock,
        game_status: match.game_status,
        score_source: "api",
        raw_payload: JSON.parse(JSON.stringify(match)),
      },
    ]);
  }

  lastSyncByGame.set(gameId, Date.now());

  return {
    synced: true,
    home_score: match.home_score,
    away_score: match.away_score,
    period: match.period,
    game_clock: match.game_clock,
    game_status: match.game_status,
  };
}
