import { createFileRoute } from "@tanstack/react-router";
import { handleSyncLiveScores } from "./sync-live-scores.server";

export const Route = createFileRoute("/api/public/hooks/sync-live-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSyncLiveScores(request),
    },
  },
});
