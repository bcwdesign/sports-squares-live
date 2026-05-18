// Public cron endpoint — backend-driven score sync that runs even when the
// host's browser tab is closed/backgrounded. Called by pg_cron every minute.
//
// Security: optional CRON_SECRET header check. The endpoint only triggers
// upstream BALLDONTLIE pulls for games the host has opted into
// (`auto_sync_enabled=true`). It never writes user-supplied data, never
// returns PII, and the per-game in-memory 5s guard in runSync prevents
// double-writes when the host browser is also polling.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-live-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSync } = await import("@/server/balldontlie.functions");

        const required = process.env.CRON_SECRET;
        if (required) {
          const got = request.headers.get("x-cron-secret");
          if (got !== required) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        const { data: games, error } = await supabaseAdmin
          .from("games")
          .select("id, status, auto_sync_enabled, external_provider, external_game_id")
          .eq("auto_sync_enabled", true)
          .eq("external_provider", "balldontlie")
          .in("status", ["lobby", "locked", "live"]);

        if (error) {
          console.error("[score-sync/cron] failed to list games:", error.message);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
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

        return Response.json({ ok: true, scanned: games?.length ?? 0, results });
      },
    },
  },
});
