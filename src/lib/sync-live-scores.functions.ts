// Public cron endpoint backing /api/public/hooks/sync-live-scores.
// Thin file: createServerFn declaration + imports only.

import { createServerFn } from "@tanstack/react-start";
import { runSync, supabaseAdminForSync } from "./sync-live-scores.server";

export const syncLiveScoresFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data: games, error } = await supabaseAdminForSync
      .from("games")
      .select("id, status, auto_sync_enabled, external_provider, external_game_id")
      .eq("auto_sync_enabled", true)
      .eq("external_provider", "balldontlie")
      .in("status", ["lobby", "locked", "live"]);

    if (error) {
      console.error("[score-sync/cron] failed to list games:", error.message);
      return { ok: false as const, error: error.message };
    }

    const results: Array<{ gameId: string; synced: boolean; reason?: string }> = [];
    for (const g of games ?? []) {
      if (!g.external_game_id) continue;
      try {
        const r = await runSync(g.id, "cron");
        results.push({ gameId: g.id, synced: r.synced, reason: r.reason });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        console.error(`[score-sync/cron] game=${g.id} error:`, msg);
        results.push({ gameId: g.id, synced: false, reason: msg });
      }
    }

    console.log(
      `[score-sync/cron] scanned=${games?.length ?? 0} updated=${results.filter((r) => r.synced).length} ${new Date().toISOString()}`,
    );

    return { ok: true as const, scanned: games?.length ?? 0, results };
  },
);
