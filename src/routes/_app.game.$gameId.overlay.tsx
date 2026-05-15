// Authenticated, member-accessible Live Watch Party overlay.
//
// Permissions: any game member (host, joined player, guest) can view this
// route. Read-only — no host controls live here. RLS on the `games`,
// `squares`, and `game_players` tables (via is_game_member) already enforces
// access; non-members will see "Loading game..." and then "Not available".
//
// Realtime updates flow through the existing useGame hook. If the user is
// not a member, `useGame` returns no rows and we show a friendly message
// with a link back to the dashboard.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { Overlay, fireConfetti } from "@/components/Overlay";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import { CommentatorCard } from "@/components/CommentatorCard";
import { useAuth } from "@/contexts/AuthContext";
import { winningSquareIndex } from "@/lib/types";
import { invokeAuthed } from "@/lib/serverFnClient";
import { generateScoreCommentary } from "@/server/commentator.functions";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/game/$gameId/overlay")({
  head: () => ({ meta: [{ title: "Live Overlay — Clutch Squares" }] }),
  component: AuthenticatedOverlayPage,
});

function AuthenticatedOverlayPage() {
  const { gameId } = Route.useParams();
  const { game, squares, players, loading } = useGame(gameId);
  const { user } = useAuth();
  const [replayKey, setReplayKey] = useState(0);
  const [showHud, setShowHud] = useState(true);

  // Auto-hide the floating HUD after a few seconds of no mouse movement so it
  // doesn't get in the way during the watch party.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      setShowHud(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowHud(false), 4000);
    };
    reveal();
    window.addEventListener("mousemove", reveal);
    window.addEventListener("touchstart", reveal);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
    };
  }, []);

  // Compute current leader for the TV-sized celebration card. Hoisted above
  // any early returns so hook order stays stable across renders.
  const winIdx = game && (game.home_score > 0 || game.away_score > 0)
    ? winningSquareIndex(game, game.home_score, game.away_score)
    : -1;
  const winRow = winIdx >= 0 ? Math.floor(winIdx / 10) : -1;
  const winCol = winIdx >= 0 ? winIdx % 10 : -1;
  const winSq = winIdx >= 0 ? squares.find((s) => s.row === winRow && s.col === winCol) : undefined;
  const winnerAvatar = useMemo(() => {
    if (!winSq?.owner_id) return null;
    return players.find((p) => p.user_id === winSq.owner_id)?.avatar_url ?? null;
  }, [players, winSq?.owner_id]);

  const hasWinner = !!winSq?.owner_id;
  const currentLeaderInfo = hasWinner && game
    ? {
        ownerName: winSq!.owner_name ?? "Player",
        ownerAvatarUrl: winnerAvatar,
        homeDigit: game.home_score % 10,
        awayDigit: game.away_score % 10,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        quarter: game.quarter,
      }
    : null;
  const lastLeaderRef = useRef<typeof currentLeaderInfo>(null);
  useEffect(() => {
    lastLeaderRef.current = currentLeaderInfo;
  });

  // Celebration only fires on milestones: quarter advance OR game completion.
  const [celebration, setCelebration] = useState<{
    info: NonNullable<typeof currentLeaderInfo>;
    key: string;
  } | null>(null);
  const prevQuarterRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    const prevQ = prevQuarterRef.current;
    const prevS = prevStatusRef.current;
    prevQuarterRef.current = game.quarter;
    prevStatusRef.current = game.status;
    if (prevQ === null) return;
    if (prevS !== "completed" && game.status === "completed") {
      const info = lastLeaderRef.current ?? currentLeaderInfo;
      if (info) setCelebration({ info, key: `final:${info.quarter}:${info.ownerName}` });
      return;
    }
    if (game.quarter > prevQ) {
      const info = lastLeaderRef.current;
      if (info) setCelebration({ info, key: `q${prevQ}:${info.ownerName}` });
    }
  }, [game?.quarter, game?.status]);

  // Host-side AI Commentator trigger loop. Only the host's tab calls the
  // server fn so we don't bill multiple times per viewer. Throttled to one
  // call per ~30s, fires on score/quarter/status changes + 60s interval
  // while live.
  const commentatorEnabled = !!(game as { commentator_enabled?: boolean } | null)?.commentator_enabled;
  const isHostUser = !!user && !!game && game.host_id === user.id;
  const lastTriggerRef = useRef<number>(0);
  const triggerCommentary = useRef<() => void>(() => {});
  triggerCommentary.current = () => {
    if (!isHostUser || !commentatorEnabled || !game) return;
    const now = Date.now();
    if (now - lastTriggerRef.current < 30_000) return;
    lastTriggerRef.current = now;
    invokeAuthed(generateScoreCommentary, { gameId: game.id }).catch((err) => {
      console.error("commentary failed", err);
    });
  };
  useEffect(() => {
    if (!isHostUser || !commentatorEnabled || !game) return;
    triggerCommentary.current();
  }, [
    isHostUser,
    commentatorEnabled,
    game?.id,
    game?.home_score,
    game?.away_score,
    game?.quarter,
    game?.status,
  ]);
  useEffect(() => {
    if (!isHostUser || !commentatorEnabled || !game || game.status !== "live") return;
    const id = setInterval(() => triggerCommentary.current(), 60_000);
    return () => clearInterval(id);
  }, [isHostUser, commentatorEnabled, game?.id, game?.status]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center text-sm font-mono uppercase tracking-widest text-muted-foreground">
        Loading watch party...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="font-display font-black text-3xl text-[color:var(--neon-orange)]">Overlay Unavailable</div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          You don't have access to this game's overlay.
        </div>
        <Link
          to="/dashboard"
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>
      </div>
    );
  }

  const isHost = !!user && game.host_id === user.id;

  return (
    <>
      <Overlay game={game} squares={squares} replayKey={replayKey} />
      <WinnerCelebration
        winner={celebration?.info ?? null}
        winnerKey={celebration?.key ?? "none"}
        replayKey={replayKey}
        variant="tv"
      />

      {/* Floating, auto-hiding HUD. Read-only navigation + host-only replay.
          Positioned to avoid the QR/footer area. */}
      <div
        className={`fixed top-3 right-3 z-50 flex items-center gap-2 transition-opacity duration-300 ${
          showHud ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Link
          to="/game/$gameId/live"
          params={{ gameId }}
          className="px-3 py-1.5 rounded-md border border-border bg-background/80 backdrop-blur text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
        >
          ← Exit overlay
        </Link>
        {isHost && (
          <button
            onClick={() => {
              setReplayKey((k) => k + 1);
              fireConfetti();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/50 bg-[color:var(--neon-orange)]/10 text-[10px] font-mono uppercase tracking-widest text-[color:var(--neon-orange)] hover:bg-[color:var(--neon-orange)]/20 transition"
          >
            <Sparkles className="w-3 h-3" /> Replay celebration
          </button>
        )}
      </div>
    </>
  );
}
