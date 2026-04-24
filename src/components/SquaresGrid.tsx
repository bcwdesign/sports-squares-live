import type { GameState } from "@/lib/gameState";
import { cn } from "@/lib/utils";

type Props = {
  state: GameState;
  user: string;
  selectedIndex: number | null;
  winningIndex?: number | null;
  onSelect?: (i: number) => void;
  showAxes?: boolean;
};

export function SquaresGrid({ state, user, selectedIndex, winningIndex, onSelect, showAxes }: Props) {
  const showDigits = state.locked && showAxes;

  return (
    <div className="w-full">
      {showDigits && (
        <div className="flex items-center mb-1">
          <div className="w-6 sm:w-8" />
          <div className="flex-1 grid grid-cols-10 gap-0.5">
            {state.homeAxis.map((d, i) => (
              <div
                key={i}
                className="text-center font-mono text-[10px] sm:text-xs font-bold text-[color:var(--neon-green)]"
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-stretch">
        {showDigits && (
          <div className="w-6 sm:w-8 grid grid-rows-10 gap-0.5 mr-1">
            {state.awayAxis.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-[color:var(--neon-blue)]"
              >
                {d}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 grid grid-cols-10 gap-0.5 sm:gap-1 aspect-square">
          {state.squares.map((sq) => {
            const isMine = sq.owner === user;
            const isSelected = selectedIndex === sq.index;
            const isWin = winningIndex === sq.index;
            const isTaken = !!sq.owner && !isMine;
            const isOpen = !sq.owner;

            return (
              <button
                key={sq.index}
                onClick={() => onSelect?.(sq.index)}
                disabled={state.locked || isTaken}
                className={cn(
                  "relative rounded-[3px] sm:rounded-md transition-all duration-150 flex items-center justify-center overflow-hidden text-[7px] sm:text-[10px] font-mono leading-none p-0.5",
                  "border",
                  isOpen && !isSelected && "bg-muted/40 border-border/40 hover:bg-muted hover:border-[color:var(--neon-blue)]/60 hover:scale-105",
                  isSelected && "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)] text-background shadow-[var(--shadow-neon-blue)] scale-105",
                  isMine && !isSelected && "bg-[color:var(--neon-blue)]/30 border-[color:var(--neon-blue)] text-[color:var(--neon-blue)]",
                  isTaken && "bg-secondary/60 border-border text-muted-foreground cursor-not-allowed",
                  isWin && "animate-pulse-glow !bg-[color:var(--neon-orange)] !border-[color:var(--neon-orange)] !text-background z-10",
                )}
              >
                {sq.owner ? (
                  <span className="truncate w-full text-center font-bold">
                    {sq.owner.slice(0, 4)}
                  </span>
                ) : (
                  <span className="opacity-30">{sq.index + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
