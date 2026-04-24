import { Link } from "@tanstack/react-router";
import type { GameState } from "@/lib/gameState";

export function TopBar({ state }: { state: GameState }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[image:var(--gradient-neon)] flex items-center justify-center font-mono font-bold text-background text-xs">
            SQ
          </div>
          <div className="font-display font-bold tracking-tight text-sm sm:text-base">
            SQUARES<span className="text-[color:var(--neon-green)]">.LIVE</span>
          </div>
        </Link>

        <div className="flex-1 flex items-center justify-center gap-3 text-xs sm:text-sm">
          <TeamBadge abbr={state.awayTeam.abbr} color="var(--neon-blue)" score={state.awayScore} />
          <div className="font-mono text-muted-foreground">VS</div>
          <TeamBadge abbr={state.homeTeam.abbr} color="var(--neon-green)" score={state.homeScore} />
        </div>

        <div className="text-right">
          <div className="font-mono text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
            {state.locked ? `Q${state.quarter === 5 ? "F" : state.quarter}` : "Pre-Game"}
          </div>
          <div className="font-mono font-bold text-sm sm:text-base text-[color:var(--neon-orange)]">
            {state.locked ? state.clock : "—:—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ abbr, color, score }: { abbr: string; color: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="px-2 py-1 rounded-md font-bold text-xs sm:text-sm"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`, color }}
      >
        {abbr}
      </div>
      <div className="font-mono font-bold text-base sm:text-xl tabular-nums">{score}</div>
    </div>
  );
}
