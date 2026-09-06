// Shared host-side auto-sync poller for BALLDONTLIE-connected games (NBA + NFL).
//
// Used by the host controls on the live page AND by the overlay / TV broadcast
// screen, so scores (and therefore quarter + final recap triggers) keep flowing
// when the host is watching the overlay full screen instead of the board.
//
// Cadence: 10s in progress, 60s scheduled/pre-game, 5min for postponed/
// delayed/suspended, off for final/canceled. Requests never overlap.

import { useEffect } from "react";
import { syncGameScore } from "@/lib/balldontlie.functions";
import { invokeAuthed } from "@/lib/serverFnClient";

type SyncableGame = {
  id: string;
  external_provider?: string | null;
  external_game_id?: string | null;
  auto_sync_enabled?: boolean | null;
  game_status?: string | null;
};

export function isLiveScoreConnected(game: SyncableGame | null | undefined): boolean {
  return !!game && game.external_provider === "balldontlie" && !!game.external_game_id;
}

/**
 * @param enabled extra gate (e.g. only the host's tab should poll).
 */
export function useLiveScoreAutoSync(game: SyncableGame | null | undefined, enabled = true) {
  const gameId = game?.id;
  const connected = isLiveScoreConnected(game);
  const autoSyncOn = !!game?.auto_sync_enabled;
  const status = (game?.game_status ?? "").toLowerCase();

  useEffect(() => {
    if (!enabled || !gameId || !connected || !autoSyncOn) return;
    if (status.includes("final")) return;
    if (status.includes("cancel") || status.includes("abandon")) return;

    const stalled =
      status.includes("postpon") || status.includes("delay") || status.includes("suspend");
    const intervalMs = stalled
      ? 300_000
      : status.includes("scheduled") || status.includes("pre") || status === ""
        ? 60_000
        : 10_000;

    let cancelled = false;
    let running = false;
    const tick = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        await invokeAuthed(syncGameScore, { gameId });
      } catch (e) {
        // Silent — the error surfaces via last_score_sync_error on the row.
        console.warn("auto-sync failed:", e);
      } finally {
        running = false;
      }
    };
    // Sync immediately so opening the overlay doesn't wait a full interval.
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, gameId, connected, autoSyncOn, status]);
}
