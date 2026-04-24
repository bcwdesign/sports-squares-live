import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { ChatPanel } from "@/components/ChatPanel";
import { NeonButton } from "@/components/NeonButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import { supabase } from "@/integrations/supabase/client";
import { winningSquareIndex } from "@/lib/types";
import { Maximize2, QrCode, RotateCcw, Sparkles, Trophy, Tv, Zap, X } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_app/game/$gameId/live")({
  head: () => ({ meta: [{ title: "Live — Clutch Squares" }] }),
  component: LivePage,
});

function LivePage() {
  const { gameId } = Route.useParams();
  const { game, squares, players, loading } = useGame(gameId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watchMode, setWatchMode] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Fetch the share token for this game and keep it in sync. The `games` table
  // is already subscribed via useGame; we re-poll when the row changes so a
  // rotated token (e.g. host re-issued the link) is picked up automatically.
  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      const { data } = await supabase
        .from("games")
        .select("share_token")
        .eq("id", gameId)
        .maybeSingle();
      if (cancelled) return;
      const token = (data as { share_token?: string } | null)?.share_token ?? null;
      setShareToken((prev) => (prev === token ? prev : token));
    };
    loadToken();
    const channel = supabase
      .channel(`game-share-token:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const next = (payload.new as { share_token?: string } | null)?.share_token ?? null;
          if (next) setShareToken((prev) => (prev === next ? prev : next));
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Regenerate the QR whenever the token changes so it never goes stale.
  useEffect(() => {
    if (!shareToken) {
      setQrDataUrl(null);
      setOverlayUrl(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    const url = `${window.location.origin}/overlay/${shareToken}`;
    QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((png) => {
        if (cancelled) return;
        setOverlayUrl(url);
        setQrDataUrl(png);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate QR");
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => { cancelled = true; };
  }, [shareToken]);

  const showQr = () => {
    if (!shareToken) {
      toast.error("Share link not ready yet");
      return;
    }
    setQrOpen(true);
  };

  const isHost = !!user && !!game && game.host_id === user.id;
  const [demoRunning, setDemoRunning] = useState(false);
  const demoCancelRef = useRef(false);
  const [resetting, setResetting] = useState(false);

  // Host-only "Demo Score Sequence": cycles through a deterministic set of
  // quarter scores so the overlay can be demonstrated end-to-end without a
  // real live feed. Pure DB writes — every player and the overlay see the
  // same updates via the existing realtime subscriptions.
  const runDemoSequence = async () => {
    if (!isHost || !game || demoRunning) return;
    demoCancelRef.current = false;
    setDemoRunning(true);
    toast.message("Demo sequence started");
    const steps: Array<{ q: number; clock: string; home: number; away: number }> = [
      { q: 1, clock: "10:00", home: 7, away: 5 },
      { q: 1, clock: "06:00", home: 14, away: 11 },
      { q: 1, clock: "00:00", home: 24, away: 22 },
      { q: 2, clock: "08:00", home: 33, away: 30 },
      { q: 2, clock: "00:00", home: 49, away: 47 },
      { q: 3, clock: "07:00", home: 60, away: 58 },
      { q: 3, clock: "00:00", home: 73, away: 75 },
      { q: 4, clock: "05:00", home: 88, away: 86 },
      { q: 4, clock: "00:00", home: 102, away: 99 },
    ];
    try {
      for (const step of steps) {
        if (demoCancelRef.current) break;
        const { error } = await supabase
          .from("games")
          .update({
            home_score: step.home,
            away_score: step.away,
            quarter: step.q,
            clock: step.clock,
            status: "live",
          })
          .eq("id", game.id);
        if (error) throw error;
        await new Promise((r) => setTimeout(r, 2200));
      }
      if (!demoCancelRef.current) toast.success("Demo sequence complete");
    } catch (e) {
      toast.error("Demo sequence failed");
    } finally {
      setDemoRunning(false);
    }
  };

  // Host-only: reset scores, quarter, clock, and status back to a fresh live
  // tip-off. Cancels any in-flight demo sequence and keeps the board (claimed
  // squares + axis numbers) intact so the demo can be re-run cleanly without
  // disturbing players' picks. Does NOT reshuffle axes — use the lobby flow
  // for a brand-new game.
  const resetGame = async () => {
    if (!isHost || !game || resetting) return;
    const ok = window.confirm(
      "Reset the game back to the lobby? Scores, quarter, and clock will clear. Claimed squares stay so players can keep their picks or claim more.",
    );
    if (!ok) return;
    demoCancelRef.current = true;
    setResetting(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          home_score: 0,
          away_score: 0,
          quarter: 1,
          clock: "12:00",
          status: "lobby",
        })
        .eq("id", game.id);
      if (error) throw error;
      toast.success("Game reset — back in the lobby");
      navigate({ to: "/game/$gameId/lobby", params: { gameId } });
    } catch (e) {
      toast.error("Couldn't reset the game");
    } finally {
      setResetting(false);
    }
  };

  // Track winning square + drive WinnerCelebration via a stable key.
  const winIdx = game ? winningSquareIndex(game, game.home_score, game.away_score) : -1;
  const winRow = winIdx >= 0 ? Math.floor(winIdx / 10) : -1;
  const winCol = winIdx >= 0 ? winIdx % 10 : -1;
  const winSq = winIdx >= 0 ? squares.find((s) => s.row === winRow && s.col === winCol) : undefined;
  const scoresEntered = !!game && (game.home_score > 0 || game.away_score > 0);
  const hasWinner = !!winSq?.owner_id;

  const winnerAvatar = useMemo(() => {
    if (!winSq?.owner_id) return null;
    return players.find((p) => p.user_id === winSq.owner_id)?.avatar_url ?? null;
  }, [players, winSq?.owner_id]);

  const winnerInfo = hasWinner && game
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

  const winnerKey = `${game?.quarter ?? 0}:${winSq?.owner_id ?? "none"}`;
  const [replayKey, setReplayKey] = useState(0);

  // Friendly toast when the winning player changes (in addition to celebration).
  const lastWinIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!game || winIdx === lastWinIdxRef.current) return;
    if (lastWinIdxRef.current !== -1 && winIdx >= 0 && winSq?.owner_name) {
      toast.success(`🔥 ${winSq.owner_name} now winning!`);
    }
    lastWinIdxRef.current = winIdx;
  }, [winIdx, game, winSq]);

  // Route to results when complete
  useEffect(() => {
    if (game?.status === "completed") {
      const t = setTimeout(() => navigate({ to: "/game/$gameId/results", params: { gameId } }), 2500);
      return () => clearTimeout(t);
    }
  }, [game?.status, gameId, navigate]);

  if (loading || !game) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading...</div>;
  }

  return (
    <div className={watchMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "min-h-screen"}>
      <TopBar game={game} />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-12">
        <div className="flex items-center justify-between mb-3 gap-2">
          <Link to="/game/$gameId/lobby" params={{ gameId }} className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Lobby</Link>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Link
              to="/game/$gameId/overlay"
              params={{ gameId }}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-orange)] transition"
            >
              <Tv className="w-3.5 h-3.5" /> {isHost ? "Open Overlay" : "View Live Overlay"}
            </Link>
            <button
              onClick={async () => {
                if (!overlayUrl) { toast.error("Share link not ready yet"); return; }
                try { await navigator.clipboard.writeText(overlayUrl); toast.success("Public overlay link copied"); }
                catch { toast.message(overlayUrl); }
              }}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-green)] transition"
            >
              <Trophy className="w-3.5 h-3.5" /> Share Overlay
            </button>
            <button
              onClick={showQr}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-green)] transition"
            >
              <QrCode className="w-3.5 h-3.5" /> Show QR
            </button>
            <button
              onClick={() => setWatchMode((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Watch Mode
            </button>
          </div>
        </div>

        {isHost && (
          <div className="mb-4 rounded-xl border border-border bg-[color:var(--surface)] p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-orange)] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Host Controls
              </span>
            </div>
            <button
              onClick={runDemoSequence}
              disabled={demoRunning || resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-orange)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cycle through fake quarter scores to demo the overlay"
            >
              <Zap className="w-3.5 h-3.5" />
              {demoRunning ? "Demo running..." : "Demo Score Sequence"}
            </button>
            <button
              onClick={resetGame}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-blue)]/40 bg-[color:var(--neon-blue)]/10 text-[color:var(--neon-blue)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-blue)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset scores and return to the lobby"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? "Resetting..." : "Reset to Lobby"}
            </button>
          </div>
        )}

        {/* Now winning */}
        <div className="rounded-2xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 p-4 mb-4 flex items-center gap-4 animate-scale-in">
          <div className="w-12 h-12 rounded-xl bg-[color:var(--neon-orange)]/20 flex items-center justify-center text-[color:var(--neon-orange)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)]">Currently winning</div>
            <div className="font-display font-bold text-xl truncate">
              {winSq?.owner_name ?? <span className="text-muted-foreground">Unclaimed square</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Digits</div>
            <div className="font-mono font-bold text-2xl text-[color:var(--neon-orange)] tabular-nums">
              {game.home_score % 10}-{game.away_score % 10}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-2 sm:p-4 shadow-[var(--shadow-card)]">
          <SquaresGrid
            game={game}
            squares={squares}
            userId={user?.id ?? null}
            selectedIndex={null}
            winningIndex={winIdx}
            showAxes
          />
        </div>

        {!watchMode && (
          <div className="mt-6">
            <ChatPanel gameId={game.id} />
          </div>
        )}

        {game.status === "completed" && (
          <Link to="/game/$gameId/results" params={{ gameId }} className="block mt-6">
            <NeonButton variant="green" className="w-full">View Final Results →</NeonButton>
          </Link>
        )}

        {!isHost && (
          <p className="text-center text-[10px] text-muted-foreground mt-4 font-mono uppercase tracking-widest">
            Host controls live scoring
          </p>
        )}
      </main>

      {qrOpen && (
        <div
          className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-green)]">Public Overlay</div>
              <div className="font-display font-bold text-xl mt-1">Scan to Watch Live</div>
              <p className="text-xs text-muted-foreground mt-1">Open this game's read-only TV overlay on any device.</p>
            </div>
            <div className="aspect-square rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden">
              {qrLoading || !qrDataUrl ? (
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Generating...</div>
              ) : (
                <img src={qrDataUrl} alt="Overlay QR code" className="w-full h-full object-contain" />
              )}
            </div>
            {overlayUrl && (
              <div className="mt-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Overlay Link</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={overlayUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground"
                  />
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(overlayUrl); toast.success("Copied"); }
                      catch { toast.message(overlayUrl); }
                    }}
                    className="px-3 py-1.5 rounded-md border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] hover:border-[color:var(--neon-blue)]/40 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
