import type { Game, Square } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  game: Game;
  squares: Square[];
  userId: string | null;
  selectedIndex: number | null;
  winningIndex?: number | null;
  onSelect?: (i: number) => void;
  showAxes?: boolean;
  /** When true, taken squares are clickable (e.g. for host to clear them). */
  allowClickTaken?: boolean;
};

export function SquaresGrid({ game, squares, userId, selectedIndex, winningIndex, onSelect, showAxes, allowClickTaken }: Props) {
  const showDigits = (game.status !== "lobby") && showAxes;
  // Build a 100-length array indexed by row*10+col
  const grid: (Square | null)[] = Array(100).fill(null);
  squares.forEach((s) => { grid[s.row * 10 + s.col] = s; });

  return (
    <div className="w-full">
      {showDigits && (
        <div className="flex items-center mb-1">
          <div className="w-6 sm:w-8" />
          <div className="flex-1 grid grid-cols-10 gap-0.5">
            {game.home_axis.map((d, i) => (
              <div key={i} className="text-center font-mono text-[10px] sm:text-xs font-bold text-[color:var(--neon-green)]">{d}</div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-stretch">
        {showDigits && (
          <div className="w-6 sm:w-8 grid grid-rows-10 gap-0.5 mr-1">
            {game.away_axis.map((d, i) => (
              <div key={i} className="flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-[color:var(--neon-blue)]">{d}</div>
            ))}
          </div>
        )}
        <div className="flex-1 grid grid-cols-10 gap-0.5 sm:gap-1 aspect-square">
          {grid.map((sq, idx) => {
            const isMine = !!sq?.owner_id && sq.owner_id === userId;
            const isSelected = selectedIndex === idx;
            const isWin = winningIndex === idx;
            const isTaken = !!sq?.owner_id && !isMine;
            const isOpen = !sq?.owner_id;
            const locked = game.status !== "lobby";

            return (
              <button
                key={idx}
                onClick={() => onSelect?.(idx)}
                disabled={locked || (isTaken && !allowClickTaken)}
                className={cn(
                  "relative rounded-[3px] sm:rounded-md transition-all duration-150 flex items-center justify-center overflow-hidden text-[7px] sm:text-[10px] font-mono leading-none p-0.5 border",
                  isOpen && !isSelected && "bg-muted/40 border-border/40 hover:bg-muted hover:border-[color:var(--neon-blue)]/60 hover:scale-105",
                  isSelected && "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)] text-background shadow-[var(--shadow-neon-blue)] scale-105",
                  isMine && !isSelected && "bg-[color:var(--neon-blue)]/30 border-[color:var(--neon-blue)] text-[color:var(--neon-blue)]",
                  isTaken && "bg-secondary/60 border-border text-muted-foreground cursor-not-allowed",
                  isWin && "animate-pulse-glow !bg-[color:var(--neon-orange)] !border-[color:var(--neon-orange)] !text-background z-10",
                )}
              >
                {sq?.owner_name ? (
                  <span className="truncate w-full text-center font-bold">{sq.owner_name.slice(0, 4)}</span>
                ) : (
                  <span className="opacity-30">{idx + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
