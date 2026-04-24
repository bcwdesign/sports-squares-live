import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useGameState } from "@/hooks/useGameState";
import { getUser, resetState } from "@/lib/gameState";
import { TopBar } from "@/components/TopBar";
import { NeonButton } from "@/components/NeonButton";
import { Trophy, Share2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — Sports Squares" },
      { name: "description", content: "Final results and quarter winners." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const [state] = useGameState();
  const navigate = useNavigate();
  const user = getUser();

  const myWinnings = state.quarterWinners
    .filter((qw) => qw.squareIndex !== null && state.squares[qw.squareIndex]?.owner === user)
    .reduce((sum, qw) => sum + qw.payout, 0);

  const share = async () => {
    const text = myWinnings > 0
      ? `🏆 I just won $${myWinnings} on Squares.Live tonight! ${state.awayTeam.abbr} vs ${state.homeTeam.abbr}`
      : `Played NBA Squares on Squares.Live tonight: ${state.awayTeam.abbr} ${state.awayScore} - ${state.homeScore} ${state.homeTeam.abbr}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Squares.Live", text, url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied to clipboard");
      }
    } catch {/* cancelled */}
  };

  const playAgain = () => {
    resetState();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <TopBar state={state} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-12">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] font-mono text-[10px] uppercase tracking-widest mb-4">
            Final Score
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl">Game Over</h1>
          <div className="mt-4 flex items-center justify-center gap-6">
            <ScorePill abbr={state.awayTeam.abbr} score={state.awayScore} color="var(--neon-blue)" />
            <div className="font-mono text-2xl text-muted-foreground">—</div>
            <ScorePill abbr={state.homeTeam.abbr} score={state.homeScore} color="var(--neon-green)" />
          </div>
        </div>

        {/* My result */}
        <div
          className="rounded-2xl border p-6 mb-6 text-center animate-scale-in"
          style={{
            borderColor: myWinnings > 0 ? "var(--neon-orange)" : "var(--border)",
            background: myWinnings > 0
              ? "color-mix(in oklab, var(--neon-orange) 12%, transparent)"
              : "var(--surface)",
            boxShadow: myWinnings > 0 ? "var(--shadow-neon-orange)" : undefined,
          }}
        >
          <Trophy className={`w-10 h-10 mx-auto mb-2 ${myWinnings > 0 ? "text-[color:var(--neon-orange)]" : "text-muted-foreground"}`} />
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your winnings</div>
          <div className="font-display font-bold text-4xl mt-1">
            {myWinnings > 0 ? (
              <span className="text-[color:var(--neon-orange)]">${myWinnings}</span>
            ) : (
              <span className="text-muted-foreground">$0</span>
            )}
          </div>
          {myWinnings > 0 && (
            <div className="mt-2 text-sm text-foreground/80">Nice play, {user} 🔥</div>
          )}
        </div>

        {/* Quarter winners */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 mb-6">
          <div className="font-display font-bold text-sm mb-3">Quarter Winners</div>
          <div className="space-y-2">
            {state.quarterWinners.map((qw) => {
              const sq = qw.squareIndex !== null ? state.squares[qw.squareIndex] : null;
              const isMe = sq?.owner === user;
              return (
                <div
                  key={qw.q}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${isMe ? "bg-[color:var(--neon-green)]/15 border border-[color:var(--neon-green)]/40" : "bg-background/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs uppercase text-muted-foreground w-8">Q{qw.q}</div>
                    <div className={`font-bold ${isMe ? "text-[color:var(--neon-green)]" : ""}`}>
                      {sq?.owner ?? "Unclaimed"}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[color:var(--neon-orange)]">${qw.payout}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={share}>
            <NeonButton variant="ghost" className="w-full">
              <Share2 className="w-4 h-4 inline mr-2" />Share
            </NeonButton>
          </button>
          <button onClick={playAgain}>
            <NeonButton variant="green" className="w-full">
              <RotateCcw className="w-4 h-4 inline mr-2" />Play Again
            </NeonButton>
          </button>
        </div>

        <Link to="/" className="block text-center mt-6 text-xs text-muted-foreground font-mono uppercase tracking-widest hover:text-foreground">
          ← Back to lobby
        </Link>
      </main>
    </div>
  );
}

function ScorePill({ abbr, score, color }: { abbr: string; score: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="font-display font-bold text-sm px-3 py-1 rounded-md inline-block"
        style={{ background: `color-mix(in oklab, ${color} 20%, transparent)`, color }}
      >
        {abbr}
      </div>
      <div className="font-mono font-bold text-5xl tabular-nums mt-1" style={{ color }}>
        {score}
      </div>
    </div>
  );
}
