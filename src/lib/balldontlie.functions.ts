// Server functions for the BALLDONTLIE NBA live scoring integration.
// Thin file: createServerFn declarations + their imports only. All helpers
// and supabaseAdmin live in balldontlie.server.ts so the import-protection
// plugin can split this module's .handler() bodies out of the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callBalldontlieLive, runSync } from "./balldontlie.server";
import type { NormalizedLiveGame } from "./balldontlie.types";

// Re-export the type for client convenience. Type-only re-exports are safe.
export type { NormalizedLiveGame };

export const fetchLiveNbaGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const result = await callBalldontlieLive();
    if (!result.ok) {
      return { games: [] as NormalizedLiveGame[], error: result.error, code: result.code };
    }
    return { games: result.data, error: null, code: null };
  });

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

    const synced = await runSync(data.gameId);
    return { ok: true, sync: synced };
  });

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
    return runSync(data.gameId, "host");
  });
