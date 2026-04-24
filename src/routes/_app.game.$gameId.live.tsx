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
import { Maximize2, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/game/$gameId/live")({
  head: () => ({ meta: [{ title: "Live — Sports Squares Live" }] }),
  component: LivePage,
});

function LivePage() {
  const { gameId } = Route.useParams();
  const { game, squares, loading } = useGame(gameId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watchMode, setWatchMode] = useState(false);

  const isHost = !!user && !!game && game.host_id === user.id;

  // Host-driven simulated game ticks (writes to DB so all players see updates).
  // In production, replace with real NBA scores API webhook.
  useEffect(() => {
    if (!isHost || !game || game.status === "completed") return;
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
      let status = g.status;
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
        <div className="flex items-center justify-between mb-3">
          <Link to="/_app/game/$gameId/lobby" params={{ gameId }} className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Lobby</Link>
          <button
            onClick={() => setWatchMode((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Watch Mode
          </button>
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
          <Link to="/_app/game/$gameId/results" params={{ gameId }} className="block mt-6">
            <NeonButton variant="green" className="w-full">View Final Results →</NeonButton>
          </Link>
        )}

        {!isHost && (
          <p className="text-center text-[10px] text-muted-foreground mt-4 font-mono uppercase tracking-widest">
            Host controls live scoring
          </p>
        )}
      </main>
    </div>
  );
}
