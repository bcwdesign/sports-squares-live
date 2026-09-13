// Server-only helpers for the NFL pre-game board randomization.
// The authoritative shuffle lives in the Postgres function
// public.finalize_nfl_board(), which is service-role only and idempotent.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

export type FinalizeResult = {
  ok: boolean;
  reason: string;
  game_id?: string;
  audit_id?: string;
  claimed_count?: number;
  player_count?: number;
  home_axis?: number[];
  away_axis?: number[];
};

/** Host (or super admin) authorization for a game. */
export async function assertGameAdmin(gameId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("host_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Game not found");
  if (data.host_id === userId) return;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!(roles ?? []).some((r) => r.role === "super_admin")) {
    throw new Error("Forbidden: host only");
  }
}

export async function finalizeBoard(
  gameId: string,
  actorId: string | null,
  source: "manual" | "cron",
): Promise<FinalizeResult> {
  const { data, error } = await supabaseAdmin.rpc("finalize_nfl_board", {
    p_game_id: gameId,
    p_actor: actorId ?? undefined,
    p_source: source,
  });
  if (error) throw new Error(error.message);
  return data as unknown as FinalizeResult;
}

export async function resetBoard(gameId: string, actorId: string): Promise<FinalizeResult> {
  const { data, error } = await supabaseAdmin.rpc("reset_nfl_board", {
    p_game_id: gameId,
    p_actor: actorId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as FinalizeResult;
}

/**
 * Finalize every NFL randomized board whose scheduled time has passed.
 * Safe to call repeatedly: finalize_nfl_board() no-ops on locked boards.
 */
export async function runDueRandomizations() {
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("id, scheduled_randomization_at")
    .eq("assignment_mode", "randomized")
    .eq("board_randomized", false)
    .not("scheduled_randomization_at", "is", null)
    .lte("scheduled_randomization_at", new Date().toISOString());

  if (error) {
    console.error("[board-randomization/cron] list failed:", error.message);
    return { scanned: 0, randomized: 0 };
  }

  let randomized = 0;
  for (const g of games ?? []) {
    try {
      const res = await finalizeBoard(g.id, null, "cron");
      if (res.reason === "randomized") randomized += 1;
    } catch (e) {
      console.error(
        `[board-randomization/cron] game=${g.id} failed:`,
        e instanceof Error ? e.message : "unknown",
      );
    }
  }
  return { scanned: games?.length ?? 0, randomized };
}
