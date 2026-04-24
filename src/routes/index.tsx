import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { NeonButton } from "@/components/NeonButton";
import { resetState } from "@/lib/gameState";
import { Trophy, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sports Squares Live — Game Lobby" },
      { name: "description", content: "Join or create a live NBA Squares game with real-time scoring." },
    ],
  }),
  component: Lobby,
});

function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { m, s, done: diff === 0 };
}

function Lobby() {
  const [state] = useGameState();
  const navigate = useNavigate();
  const { m, s, done } = useCountdown(state.tipoff);
  const filled = state.squares.filter((sq) => sq.owner).length;
  const pct = filled;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] font-mono text-[10px] uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-orange)] animate-pulse" />
            Tonight · Live
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight leading-none">
            NBA <span className="text-[color:var(--neon-blue)]">FINALS</span>
            <br />
            <span className="text-[color:var(--neon-green)]">GAME 5</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Pick your square. Win the quarter. Settle it on the second screen.
          </p>
        </div>

        {/* Matchup card */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)] mb-6 animate-scale-in">
          <div className="flex items-center justify-between gap-4">
            <TeamPill name={state.awayTeam.name} abbr={state.awayTeam.abbr} color="var(--neon-blue)" />
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tip-off in</div>
              <div className="font-mono font-bold text-2xl sm:text-3xl text-[color:var(--neon-orange)] tabular-nums">
                {done ? "LIVE" : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
              </div>
            </div>
            <TeamPill name={state.homeTeam.name} abbr={state.homeTeam.abbr} color="var(--neon-green)" />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              <span>Squares filled</span>
              <span className="text-foreground font-bold">{filled}/100</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[image:var(--gradient-neon)] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={<Users className="w-4 h-4" />} label="Players" value={`${new Set(state.squares.filter(s=>s.owner).map(s=>s.owner)).size}`} />
            <Stat icon={<Trophy className="w-4 h-4" />} label="Pot" value="$2K" />
            <Stat icon={<Zap className="w-4 h-4" />} label="Buy-in" value="$20" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/squares" className="w-full">
            <NeonButton variant="blue" className="w-full">
              Join Game
            </NeonButton>
          </Link>
          <button
            onClick={() => {
              resetState();
              navigate({ to: "/squares" });
            }}
            className="w-full"
          >
            <NeonButton variant="ghost" className="w-full">
              Create New Game
            </NeonButton>
          </button>
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground font-mono">
          POWERED BY <span className="text-[color:var(--neon-green)]">SQUARES.LIVE</span>
        </div>
      </main>
    </div>
  );
}

function TeamPill({ name, abbr, color }: { name: string; abbr: string; color: string }) {
  return (
    <div className="flex flex-col items-center text-center flex-1">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-xl mb-2"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
          color,
          boxShadow: `0 0 24px color-mix(in oklab, ${color} 30%, transparent)`,
        }}
      >
        {abbr}
      </div>
      <div className="font-display font-bold text-sm">{name}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border p-3 text-center">
      <div className="flex items-center justify-center text-muted-foreground mb-1">{icon}</div>
      <div className="font-mono font-bold text-base">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
