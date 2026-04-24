import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { ChatPanel } from "@/components/ChatPanel";
import { NeonButton } from "@/components/NeonButton";
import { supabase } from "@/integrations/supabase/client";
import { winningSquareIndex } from "@/lib/types";
import { Maximize2, QrCode, Trophy, Tv, Zap, X } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_app/game/$gameId/live")({
  head: () => ({ meta: [{ title: "Live — Clutch Squares" }] }),
  component: LivePage,
});

function LivePage() {
  const { gameId } = Route.useParams();
  const { game, squares, loading } = useGame(gameId);
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

  // Host-only "Demo Score Sequence": cycles through a deterministic set of
  // quarter scores so the overlay can be demonstrated end-to-end without a
  // real live feed. Pure DB writes — every player and the overlay see the
  // same updates via the existing realtime subscriptions.
  const runDemoSequence = async () => {
    if (!isHost || !game || demoRunning) return;
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
      toast.success("Demo sequence complete");
    } catch (e) {
      toast.error("Demo sequence failed");
    } finally {
      setDemoRunning(false);
    }
  };

  // Host-driven simulated game ticks (writes to DB so all players see updates).
  // In production, replace with real NBA scores API webhook.
  useEffect(() => {
    if (!isHost || !game || game.status === "completed" || demoRunning) return;
    const id = setInterval(async () => {
      const fresh = await supabase.from("games").select("*").eq("id", game.id).maybeSingle();
      if (!fresh.data) return;
      const g = fresh.data;
      if (g.status === "completed") return;

      const homeAdd = Math.random() < 0.55 ? (Math.random() < 0.3 ? 3 : 2) : 0;
      const awayAdd = Math.random() < 0.55 ? (Math.random() < 0.3 ? 3 : 2) : 0;
      const [mm, ss] = g.clock.split(":").map(Number);
      let total = mm * 60 + ss - 24;
      let quarter = g.quarter;
      let status: "lobby" | "locked" | "live" | "completed" = g.status;
      if (total <= 0) {
        if (quarter >= 4) {
          status = "completed";
          total = 0;
        } else {
          quarter += 1;
          total = 12 * 60;
        }
      }
      const m = Math.floor(total / 60);
      const sec = total % 60;
      await supabase.from("games").update({
        home_score: g.home_score + homeAdd,
        away_score: g.away_score + awayAdd,
        clock: `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
        quarter,
        status,
      }).eq("id", g.id);
    }, 2000);
    return () => clearInterval(id);
  }, [isHost, game]);

  // Notify when a winning square changes
  const winIdx = game ? winningSquareIndex(game, game.home_score, game.away_score) : -1;
  const [lastWinIdx, setLastWinIdx] = useState<number>(-1);
  useEffect(() => {
    if (!game || winIdx === lastWinIdx) return;
    if (lastWinIdx !== -1 && winIdx >= 0) {
      const row = Math.floor(winIdx / 10);
      const col = winIdx % 10;
      const sq = squares.find((s) => s.row === row && s.col === col);
      if (sq?.owner_name) toast.success(`🔥 ${sq.owner_name} now winning!`);
    }
    setLastWinIdx(winIdx);
  }, [winIdx, lastWinIdx, game, squares]);

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

  const winRow = Math.floor(winIdx / 10);
  const winCol = winIdx % 10;
  const winSq = squares.find((s) => s.row === winRow && s.col === winCol);

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
            {isHost && (
              <button
                onClick={runDemoSequence}
                disabled={demoRunning}
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-orange)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cycle through fake quarter scores to demo the overlay"
              >
                <Zap className="w-3.5 h-3.5" /> {demoRunning ? "Demo running..." : "Demo Score Sequence"}
              </button>
            )}
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
