import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { getUser, winningIndex } from "@/lib/gameState";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { NeonButton } from "@/components/NeonButton";
import { ChatPanel } from "@/components/ChatPanel";
import { Maximize2, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live — Sports Squares" },
      { name: "description", content: "Live scoring and winning squares in real time." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const [state, update] = useGameState();
  const navigate = useNavigate();
  const user = getUser();
  const [watchMode, setWatchMode] = useState(false);
  const tickRef = useRef(0);

  const winIdx = winningIndex(state, state.homeScore, state.awayScore);

  // Simulate live game ticks
  useEffect(() => {
    if (!state.locked || state.quarter === 5) return;
    const id = setInterval(() => {
      tickRef.current++;
      update((s) => {
        if (!s.locked || s.quarter === 5) return s;

        const homeAdd = Math.random() < 0.55 ? (Math.random() < 0.3 ? 3 : 2) : 0;
        const awayAdd = Math.random() < 0.55 ? (Math.random() < 0.3 ? 3 : 2) : 0;

        // Decrement clock
        const [mm, ss] = s.clock.split(":").map(Number);
        let total = mm * 60 + ss - 18;
        let quarter: 1 | 2 | 3 | 4 | 5 = s.quarter;
        const winners = [...s.quarterWinners];

        if (total <= 0) {
          // End of quarter
          const idx = winningIndex(s, s.homeScore + homeAdd, s.awayScore + awayAdd);
          const qIdx = quarter - 1;
          if (qIdx >= 0 && qIdx < 4) {
            winners[qIdx] = { ...winners[qIdx], squareIndex: idx };
            const winnerName = s.squares[idx]?.owner ?? "Unclaimed";
            toast.success(`Q${quarter} Winner: ${winnerName}`, {
              description: `Final digits ${(s.homeScore + homeAdd) % 10}-${(s.awayScore + awayAdd) % 10}`,
            });
          }
          if (quarter === 4) {
            quarter = 5;
            total = 0;
          } else {
            quarter = (quarter + 1) as 1 | 2 | 3 | 4;
            total = 12 * 60;
          }
        }

        const m = Math.floor(total / 60);
        const sec = total % 60;
        return {
          ...s,
          homeScore: s.homeScore + homeAdd,
          awayScore: s.awayScore + awayAdd,
          clock: `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
          quarter,
          quarterWinners: winners,
        };
      });
    }, 1500);
    return () => clearInterval(id);
  }, [state.locked, state.quarter, update]);

  useEffect(() => {
    if (state.quarter === 5) {
      const t = setTimeout(() => navigate({ to: "/results" }), 2500);
      return () => clearTimeout(t);
    }
  }, [state.quarter, navigate]);

  const winnerName = state.squares[winIdx]?.owner;

  return (
    <div className={watchMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "min-h-screen"}>
      <TopBar state={state} />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-12">
        <div className="flex items-center justify-between mb-3">
          <Link to="/squares" className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Squares</Link>
          <button
            onClick={() => setWatchMode((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Watch Mode
          </button>
        </div>

        {/* Now winning banner */}
        <div className="rounded-2xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 p-4 mb-4 flex items-center gap-4 animate-scale-in">
          <div className="w-12 h-12 rounded-xl bg-[color:var(--neon-orange)]/20 flex items-center justify-center text-[color:var(--neon-orange)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)]">Currently winning</div>
            <div className="font-display font-bold text-xl truncate">
              {winnerName ?? <span className="text-muted-foreground">Unclaimed square</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Digits</div>
            <div className="font-mono font-bold text-2xl text-[color:var(--neon-orange)] tabular-nums">
              {state.homeScore % 10}-{state.awayScore % 10}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-2 sm:p-4 shadow-[var(--shadow-card)]">
          <SquaresGrid
            state={state}
            user={user}
            selectedIndex={null}
            winningIndex={winIdx}
            showAxes
          />
        </div>

        {/* Quarter winners strip */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {state.quarterWinners.map((qw) => {
            const sq = qw.squareIndex !== null ? state.squares[qw.squareIndex] : null;
            const done = qw.squareIndex !== null;
            return (
              <div
                key={qw.q}
                className={`rounded-lg border p-2 text-center ${done ? "border-[color:var(--neon-green)]/50 bg-[color:var(--neon-green)]/10" : "border-border bg-background/40"}`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Q{qw.q}</div>
                <div className={`font-bold text-sm truncate ${done ? "text-[color:var(--neon-green)]" : "text-muted-foreground"}`}>
                  {done ? sq?.owner ?? "—" : "Pending"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">${qw.payout}</div>
              </div>
            );
          })}
        </div>

        {!watchMode && (
          <div className="mt-6">
            <ChatPanel />
          </div>
        )}

        {state.quarter === 5 && (
          <Link to="/results" className="block mt-6">
            <NeonButton variant="green" className="w-full">View Final Results →</NeonButton>
          </Link>
        )}
      </main>
    </div>
  );
}
