import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { NeonButton } from "@/components/NeonButton";
import { RecapCard, RECAP_CARD_SIZE, type QuarterResult } from "@/components/RecapCard";
import { Trophy, Share2, RotateCcw, Image as ImageIcon, Download, X } from "lucide-react";
import { toast } from "sonner";
import { winningSquareIndex } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { toPng } from "html-to-image";

export const Route = createFileRoute("/_app/game/$gameId/results")({
  head: () => ({ meta: [{ title: "Results — Clutch Squares" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { gameId } = Route.useParams();
  const { game, squares, players, loading } = useGame(gameId);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<QuarterResult[]>([]);
  const recapRef = useRef<HTMLDivElement | null>(null);

  // Load quarter winners from the snapshot table.
  useEffect(() => {
    if (!gameId) return;
    let active = true;
    supabase
      .from("quarter_results")
      .select("quarter, home_score, away_score, home_digit, away_digit, winner_name, is_final")
      .eq("game_id", gameId)
      .order("quarter")
      .then(({ data }) => {
        if (active && data) setResults(data as QuarterResult[]);
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  if (loading || !game) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading...</div>;
  }

  const winIdx = winningSquareIndex(game, game.home_score, game.away_score);
  const winRow = Math.floor(winIdx / 10);
  const winCol = winIdx % 10;
  const winSq = squares.find((s) => s.row === winRow && s.col === winCol);
  const youWon = winSq?.owner_id === user?.id;
  const isHost = !!user && game.host_id === user.id;

  const mvpAvatarUrl = useMemo(() => {
    if (!winSq?.owner_id) return null;
    return players.find((p) => p.user_id === winSq.owner_id)?.avatar_url ?? null;
  }, [players, winSq?.owner_id]);

  // Generate a PNG of the recap card and either download it or fire the
  // Web Share sheet with the image attached when supported.
  const exportRecap = async (mode: "share" | "download") => {
    if (!recapRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(recapRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: RECAP_CARD_SIZE.width,
        height: RECAP_CARD_SIZE.height,
        backgroundColor: "#000000",
      });
      const filename = `clutch-squares-${game.away_team}-${game.home_team}.png`;

      if (mode === "share") {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        const nav = navigator as Navigator & {
          canShare?: (data: { files: File[] }) => boolean;
          share?: (data: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
        };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({
            files: [file],
            title: "Clutch Squares Recap",
            text: `${game.away_team} ${game.away_score} – ${game.home_score} ${game.home_team}`,
          });
          return;
        }
      }

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Recap saved to your device");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't generate recap image");
    } finally {
      setExporting(false);
    }
  };

  // Host-only: rewind a completed game back to a fresh tip-off so the demo
  // (or a real game) can be re-run. Keeps claimed squares intact and routes
  // the host back to the live page.
  const resetGame = async () => {
    if (!isHost || resetting) return;
    const ok = window.confirm(
      "Reset the game back to the lobby? Scores, quarter, and clock will clear. Claimed squares stay so players can keep their picks or claim more.",
    );
    if (!ok) return;
    setResetting(true);
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
    setResetting(false);
    if (error) {
      toast.error("Couldn't reset the game");
      return;
    }
    toast.success("Game reset — back in the lobby");
    navigate({ to: "/game/$gameId/lobby", params: { gameId } });
  };

  const share = async () => {
    const text = youWon
      ? `🏆 I just won on Clutch Squares! ${game.away_team} ${game.away_score} - ${game.home_score} ${game.home_team}`
      : `Played Squares on Clutch Squares: ${game.away_team} ${game.away_score} - ${game.home_score} ${game.home_team}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clutch Squares", text, url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      }
    } catch {/* cancelled */}
  };

  return (
    <div className="min-h-screen">
      <TopBar game={game} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-12">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] font-mono text-[10px] uppercase tracking-widest mb-4">
            Final Score
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl">Game Over</h1>
          <div className="mt-4 flex items-center justify-center gap-6">
            <ScorePill abbr={game.away_team} score={game.away_score} color="var(--neon-blue)" />
            <div className="font-mono text-2xl text-muted-foreground">—</div>
            <ScorePill abbr={game.home_team} score={game.home_score} color="var(--neon-green)" />
          </div>
        </div>

        {/* Final winner */}
        <div
          className="rounded-2xl border p-6 mb-6 text-center animate-scale-in"
          style={{
            borderColor: youWon ? "var(--neon-orange)" : "var(--border)",
            background: youWon ? "color-mix(in oklab, var(--neon-orange) 12%, transparent)" : "var(--surface)",
            boxShadow: youWon ? "var(--shadow-neon-orange)" : undefined,
          }}
        >
          <Trophy className={`w-10 h-10 mx-auto mb-2 ${youWon ? "text-[color:var(--neon-orange)]" : "text-muted-foreground"}`} />
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Final Winner</div>
          <div className="font-display font-bold text-3xl mt-1">
            {winSq?.owner_name ? (
              <span className={youWon ? "text-[color:var(--neon-orange)]" : ""}>{winSq.owner_name}</span>
            ) : (
              <span className="text-muted-foreground">Unclaimed</span>
            )}
          </div>
          {youWon && profile && (
            <div className="mt-2 text-sm text-foreground/80">Nice play, {profile.display_name} 🔥</div>
          )}
          {game.entry_amount_label && (
            <div className="mt-3 font-mono text-xs text-muted-foreground">{game.entry_amount_label}</div>
          )}
        </div>

        {/* All claimed squares stats */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 mb-6">
          <div className="font-display font-bold text-sm mb-3">Game Stats</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Squares" value={`${squares.filter((s) => s.owner_id).length}/100`} />
            <Stat label="Quarters" value={`${Math.min(4, game.quarter)}`} />
            <Stat label="Final Digits" value={`${game.home_score % 10}-${game.away_score % 10}`} />
          </div>
        </div>

        {/* Recap card CTA */}
        <button
          onClick={() => setRecapOpen(true)}
          className="block w-full mb-3"
        >
          <NeonButton variant="orange" className="w-full">
            <ImageIcon className="w-4 h-4 inline mr-2" />
            Generate Shareable Recap
          </NeonButton>
        </button>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={share}>
            <NeonButton variant="ghost" className="w-full">
              <Share2 className="w-4 h-4 inline mr-2" />Share Text
            </NeonButton>
          </button>
          <Link to="/dashboard">
            <NeonButton variant="green" className="w-full">Play Again</NeonButton>
          </Link>
        </div>

        {isHost && (
          <button onClick={resetGame} disabled={resetting} className="block w-full mt-3">
            <NeonButton variant="ghost" className="w-full">
              <RotateCcw className="w-4 h-4 inline mr-2" />
              {resetting ? "Resetting..." : "Reset Game (Re-run Demo)"}
            </NeonButton>
          </button>
        )}

        <Link to="/dashboard" className="block text-center mt-6 text-xs text-muted-foreground font-mono uppercase tracking-widest hover:text-foreground">
          ← Back to dashboard
        </Link>
      </main>

      {/* Recap card preview / share modal */}
      {recapOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-4 sm:p-6 animate-fade-in"
          onClick={() => setRecapOpen(false)}
        >
          <div
            className="w-full max-w-md flex items-center justify-between mb-3 sm:mb-4 sticky top-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono uppercase tracking-[0.3em] text-[10px] text-[color:var(--neon-green)]">
              Shareable Recap
            </div>
            <button
              onClick={() => setRecapOpen(false)}
              className="p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scaled preview wrapper. The card itself renders at 1080x1350. */}
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              style={{ aspectRatio: `${RECAP_CARD_SIZE.width} / ${RECAP_CARD_SIZE.height}` }}
            >
              {/* Hidden full-size source for export, then scaled to preview width. */}
              <div
                style={{
                  width: RECAP_CARD_SIZE.width,
                  height: RECAP_CARD_SIZE.height,
                  transform: "scale(var(--recap-scale))",
                  transformOrigin: "top left",
                  // The wrapper sets --recap-scale based on its actual rendered width.
                }}
                ref={(el) => {
                  if (!el) return;
                  const parent = el.parentElement;
                  if (!parent) return;
                  const apply = () => {
                    const w = parent.clientWidth;
                    el.style.setProperty("--recap-scale", `${w / RECAP_CARD_SIZE.width}`);
                  };
                  apply();
                  // Re-apply on resize.
                  const ro = new ResizeObserver(apply);
                  ro.observe(parent);
                }}
              >
                <div ref={recapRef}>
                  <RecapCard
                    game={game}
                    results={results}
                    mvpName={winSq?.owner_name ?? null}
                    mvpAvatarUrl={mvpAvatarUrl}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="w-full max-w-md grid grid-cols-2 gap-3 mt-4 sm:mt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => exportRecap("download")} disabled={exporting}>
              <NeonButton variant="ghost" className="w-full">
                <Download className="w-4 h-4 inline mr-2" />
                {exporting ? "Rendering..." : "Download"}
              </NeonButton>
            </button>
            <button onClick={() => exportRecap("share")} disabled={exporting}>
              <NeonButton variant="orange" className="w-full">
                <Share2 className="w-4 h-4 inline mr-2" />
                Share
              </NeonButton>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePill({ abbr, score, color }: { abbr: string; score: number; color: string }) {
  return (
    <div className="text-center">
      <div className="font-display font-bold text-sm px-3 py-1 rounded-md inline-block" style={{ background: `color-mix(in oklab, ${color} 20%, transparent)`, color }}>
        {abbr}
      </div>
      <div className="font-mono font-bold text-5xl tabular-nums mt-1" style={{ color }}>{score}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border p-3">
      <div className="font-mono font-bold text-base">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
