import { Link } from "@tanstack/react-router";
import type { Game } from "@/lib/types";

export function TopBar({ game }: { game: Game }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[image:var(--gradient-neon)] flex items-center justify-center font-mono font-bold text-background text-xs">
            SQ
          </div>
          <div className="font-display font-bold tracking-tight text-sm sm:text-base hidden sm:block">
            SQUARES<span className="text-[color:var(--neon-green)]">.LIVE</span>
          </div>
        </Link>

        <div className="flex-1 flex items-center justify-center gap-3 text-xs sm:text-sm">
          <TeamBadge abbr={shortTeam(game.away_team)} color="var(--neon-blue)" score={game.away_score} />
          <div className="font-mono text-muted-foreground">VS</div>
          <TeamBadge abbr={shortTeam(game.home_team)} color="var(--neon-green)" score={game.home_score} />
        </div>

        <div className="text-right">
          <div className="font-mono text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
            {game.status === "lobby" ? "Lobby" : game.status === "completed" ? "Final" : `Q${game.quarter}`}
          </div>
          <div className="font-mono font-bold text-sm sm:text-base text-[color:var(--neon-orange)]">
            {game.status === "live" || game.status === "locked" ? game.clock : "—:—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function shortTeam(name: string) {
  return name.length <= 4 ? name.toUpperCase() : name.slice(0, 3).toUpperCase();
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
