import { createFileRoute } from "@tanstack/react-router";
import { syncLiveScoresFn } from "@/lib/sync-live-scores.functions";

export const Route = createFileRoute("/api/public/hooks/sync-live-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const required = process.env.CRON_SECRET;
        if (required) {
          const got = request.headers.get("x-cron-secret");
          if (got !== required) {
            return new Response("Unauthorized", { status: 401 });
          }
        }
        const res = await syncLiveScoresFn();
        const status = res.ok ? 200 : 500;
        return Response.json(res, { status });
      },
    },
  },
});
