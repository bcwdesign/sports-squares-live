// Read-only Live Watch Party overlay UI shared by:
//  - /overlay/$token        (public, RPC-backed, polling)
//  - /game/$gameId/overlay  (auth-gated, RLS-backed, realtime via useGame)
//
// This component is purely presentational. All data must be passed in by the
// parent route. It must remain read-only — no host controls live here.

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { winningSquareIndex, type Game, type Square } from "@/lib/types";
import { cn } from "@/lib/utils";

export type OverlayProps = {
  game: Game;
  squares: Square[];
  /**
   * Bumping this number forces a winner-celebration replay even when the
   * underlying winner identity has not changed. Used by the host's
   * "Replay winner celebration" control.
   */
  replayKey?: number;
};

export function Overlay({ game, squares, replayKey = 0 }: OverlayProps) {
  const scoresEntered = game.home_score > 0 || game.away_score > 0;
  const winIdx = scoresEntered ? winningSquareIndex(game, game.home_score, game.away_score) : -1;
  const winRow = winIdx >= 0 ? Math.floor(winIdx / 10) : -1;
  const winCol = winIdx >= 0 ? winIdx % 10 : -1;
  const winSq = winIdx >= 0 ? squares.find((s) => s.row === winRow && s.col === winCol) : undefined;
  const hasWinner = !!winSq?.owner_name;

  // Fire confetti only at milestones: when the quarter advances (the just-
  // ended quarter has a winner) OR when the game completes. Mid-quarter score
  // changes do NOT trigger confetti.
  const prevQuarterRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const lastHadWinnerRef = useRef<boolean>(false);
  useEffect(() => {
    const prevQ = prevQuarterRef.current;
    const prevS = prevStatusRef.current;
    const hadWinner = lastHadWinnerRef.current;
    prevQuarterRef.current = game.quarter;
    prevStatusRef.current = game.status;
    lastHadWinnerRef.current = hasWinner;
    if (prevQ === null) return;
    const completed = prevS !== "completed" && game.status === "completed";
    const advanced = game.quarter > prevQ;
    if ((completed || advanced) && (hadWinner || hasWinner)) {
      fireConfetti();
    }
  }, [game.quarter, game.status, hasWinner]);

  const firstReplay = useRef(true);
  useEffect(() => {
    if (firstReplay.current) {
      firstReplay.current = false;
      return;
    }
    if (hasWinner) fireConfetti();
  }, [replayKey, hasWinner]);

  return (
    <div
      className="fixed inset-0 bg-background overflow-y-auto md:overflow-hidden flex flex-col [scroll-behavior:smooth] [overflow-anchor:auto] overscroll-contain"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 0%, oklch(0.72 0.22 240 / 0.18), transparent 50%), radial-gradient(circle at 88% 100%, oklch(0.82 0.24 145 / 0.16), transparent 50%)",
        }}
      />

      <TopBranding game={game} />

      {/* On mobile: stack naturally, no min-h-0 clipping. On desktop: fixed grid. */}
      <div className="relative md:flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 px-3 md:px-8 py-3 md:py-4 md:min-h-0">
        <div className="md:col-span-8 flex flex-col md:min-h-0">
          <BoardArea game={game} squares={squares} winIdx={winIdx} />
        </div>
        <div className="md:col-span-4 flex flex-col md:min-h-0">
          <WinnerPanel game={game} winSq={winSq} scoresEntered={scoresEntered} />
        </div>
      </div>

      <BottomBar game={game} />
    </div>
  );
}

function TopBranding({ game }: { game: Game }) {
  return (
    <div className="relative px-4 md:px-8 pt-4 md:pt-6 pb-3 flex flex-col md:block gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-[image:var(--gradient-neon)] flex items-center justify-center font-mono font-black text-background text-sm md:text-base">
            CS
          </div>
          <div>
            <div className="font-display font-black tracking-tight text-lg md:text-2xl leading-none">
              <span className="text-[color:var(--neon-blue)]">CLUTCH</span>{" "}
              <span className="text-[color:var(--neon-green)]">SQUARES</span>
            </div>
            <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] md:tracking-[0.3em] text-muted-foreground mt-1">
              Live Watch Party
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-destructive/40 bg-destructive/10">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-destructive font-bold">Live</span>
          </div>
          <div className="hidden sm:block font-mono text-xs uppercase tracking-widest text-muted-foreground">{game.sport}</div>
        </div>
      </div>

      {/* Mobile scoreboard — inline below logo row */}
      <div className="flex md:hidden items-center justify-center gap-3">
        <ScoreSide team={game.away_team} score={game.away_score} color="var(--neon-blue)" align="right" />
        <div className="flex flex-col items-center min-w-[80px]">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {game.status === "completed" ? "Final" : `Q${game.quarter}`}
          </div>
          <div className="font-mono font-black text-xl text-[color:var(--neon-orange)] tabular-nums">
            {game.status === "completed" ? "—" : game.clock}
          </div>
        </div>
        <ScoreSide team={game.home_team} score={game.home_score} color="var(--neon-green)" align="left" />
      </div>

      {/* Desktop scoreboard — absolutely positioned center */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-5 items-center gap-6">
        <ScoreSide team={game.away_team} score={game.away_score} color="var(--neon-blue)" align="right" />
        <div className="flex flex-col items-center min-w-[120px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {game.status === "completed" ? "Final" : `Quarter ${game.quarter}`}
          </div>
          <div className="font-mono font-black text-3xl text-[color:var(--neon-orange)] tabular-nums">
            {game.status === "completed" ? "—" : game.clock}
          </div>
        </div>
        <ScoreSide team={game.home_team} score={game.home_score} color="var(--neon-green)" align="left" />
      </div>
    </div>
  );
}

function ScoreSide({
  team,
  score,
  color,
  align,
}: {
  team: string;
  score: number;
  color: string;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex items-center gap-2 md:gap-3", align === "right" && "flex-row-reverse")}>
      <div
        className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-display font-black text-base md:text-xl tracking-wide"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
          color,
          border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
        }}
      >
        {shortTeam(team)}
      </div>
      <div className="font-mono font-black text-3xl md:text-5xl tabular-nums" style={{ color }}>
        {score}
      </div>
    </div>
  );
}

function BoardArea({ game, squares, winIdx }: { game: Game; squares: Square[]; winIdx: number }) {
  const grid: (Square | null)[] = Array(100).fill(null);
  squares.forEach((s) => {
    grid[s.row * 10 + s.col] = s;
  });
  const winRow = winIdx >= 0 ? Math.floor(winIdx / 10) : -1;
  const winCol = winIdx >= 0 ? winIdx % 10 : -1;

  return (
    <div className="rounded-2xl border border-border bg-[color:var(--surface)]/80 backdrop-blur-sm p-2 md:p-4 shadow-[var(--shadow-card)] md:flex-1 flex flex-col md:min-h-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Squares Board</div>
        <div className="flex items-center gap-2 md:gap-3 text-[10px] font-mono uppercase tracking-widest">
          <LegendDot color="var(--neon-blue)" label="Claimed" />
          <LegendDot color="var(--neon-orange)" label="Winning" pulse />
        </div>
      </div>

      <div className="flex items-center mb-1 md:mb-1.5">
        <div className="w-5 md:w-8" />
        <div className="flex-1 grid grid-cols-10 gap-0.5 md:gap-1">
          {game.home_axis.map((d, i) => (
            <div
              key={i}
              className={cn(
                "text-center font-mono font-black text-[11px] md:text-base tabular-nums transition-colors",
                i === winCol ? "text-[color:var(--neon-orange)]" : "text-[color:var(--neon-green)]",
              )}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-stretch md:flex-1 md:min-h-0">
        <div className="w-5 md:w-8 grid grid-rows-10 gap-0.5 md:gap-1 mr-1 md:mr-1.5">
          {game.away_axis.map((d, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center font-mono font-black text-[11px] md:text-base tabular-nums transition-colors",
                i === winRow ? "text-[color:var(--neon-orange)]" : "text-[color:var(--neon-blue)]",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-10 gap-0.5 md:gap-1 aspect-square md:max-h-full">
          {grid.map((sq, idx) => {
            const isWin = winIdx === idx;
            const isClaimed = !!sq?.owner_id;
            return (
              <div
                key={idx}
                className={cn(
                  "relative rounded md:rounded-md flex items-center justify-center overflow-hidden text-[8px] md:text-[10px] font-mono leading-none p-0.5 md:p-1 border transition-all",
                  !isClaimed && !isWin && "bg-muted/30 border-border/40",
                  isClaimed && !isWin && "bg-[color:var(--neon-blue)]/20 border-[color:var(--neon-blue)]/50",
                  isWin && "!bg-[color:var(--neon-orange)] !border-[color:var(--neon-orange)] animate-winner-pulse z-10",
                )}
              >
                {sq?.owner_name ? (
                  <span
                    className={cn(
                      "truncate w-full text-center font-bold",
                      isWin ? "text-background text-[9px] md:text-xs" : "text-[color:var(--neon-blue)]",
                    )}
                  >
                    {sq.owner_name.slice(0, 6)}
                  </span>
                ) : (
                  <span className="opacity-20">{idx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn("w-2 h-2 rounded-full", pulse && "animate-pulse")}
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function WinnerPanel({
  game,
  winSq,
  scoresEntered,
}: {
  game: Game;
  winSq: Square | undefined;
  scoresEntered: boolean;
}) {
  const hasWinner = !!winSq?.owner_name;
  const homeDigit = game.home_score % 10;
  const awayDigit = game.away_score % 10;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4 md:p-6 flex flex-col md:flex-1 md:min-h-0 transition-all",
        hasWinner
          ? "border-[color:var(--neon-orange)]/60 bg-[color:var(--neon-orange)]/10 shadow-[var(--shadow-neon-orange)]"
          : "border-border bg-[color:var(--surface)]/80",
      )}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Currently Winning</div>
        <div
          className={cn(
            "px-2 py-1 rounded-md font-mono text-[10px] uppercase tracking-widest font-bold",
            hasWinner ? "bg-[color:var(--neon-orange)] text-background" : "bg-muted text-muted-foreground",
          )}
        >
          Q{game.quarter}
        </div>
      </div>

      {!scoresEntered ? (
        <EmptyState title="No Winner Yet" subtitle="Waiting for the first score..." icon={<Trophy className="w-10 h-10" />} />
      ) : !hasWinner ? (
        <EmptyState title="Unclaimed Square" subtitle="The winning square has no owner." icon={<Trophy className="w-10 h-10" />} />
      ) : (
        <div key={winSq!.owner_id} className="flex-1 flex flex-col items-center justify-center text-center animate-bounce-in py-2">
          <Avatar name={winSq!.owner_name!} />
          <div className="font-display font-black text-2xl md:text-3xl mt-3 md:mt-4 leading-tight">{winSq!.owner_name}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">
            Holds the winning square
          </div>

          <div className="mt-4 md:mt-6 flex items-center gap-3">
            <DigitChip digit={awayDigit} color="var(--neon-blue)" label={shortTeam(game.away_team)} />
            <div className="font-mono text-2xl font-black text-muted-foreground">×</div>
            <DigitChip digit={homeDigit} color="var(--neon-green)" label={shortTeam(game.home_team)} />
          </div>
        </div>
      )}

      <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border/60">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
          {game.status === "completed"
            ? "Game complete"
            : scoresEntered
              ? "Waiting for next score update"
              : "Scores will appear when the game starts"}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center font-display font-black text-2xl md:text-3xl text-background"
      style={{ backgroundImage: "var(--gradient-neon)", boxShadow: "var(--shadow-neon-orange)" }}
    >
      {initials || "?"}
    </div>
  );
}

function DigitChip({ digit, color, label }: { digit: number; color: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center font-mono font-black text-2xl tabular-nums"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
          color,
          border: `2px solid ${color}`,
          boxShadow: `0 0 16px color-mix(in oklab, ${color} 40%, transparent)`,
        }}
      >
        {digit}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
      <div className="opacity-40">{icon}</div>
      <div className="font-display font-bold text-xl mt-3">{title}</div>
      <div className="font-mono text-[11px] uppercase tracking-widest mt-1">{subtitle}</div>
    </div>
  );
}

function BottomBar({ game }: { game: Game }) {
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${game.invite_code}`;
  }, [game.invite_code]);
  const shortUrl = joinUrl.replace(/^https?:\/\//, "");

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 240, color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [joinUrl]);

  return (
    <div className="relative px-4 md:px-8 py-3 md:py-4 border-t border-border/60 bg-[color:var(--surface)]/60 backdrop-blur-sm flex flex-col md:flex-row items-center md:items-center justify-between gap-3 md:gap-6">
      <div className="flex items-center gap-3 md:gap-4">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Join QR code" className="w-14 h-14 md:w-20 md:h-20 rounded-lg bg-white p-1 md:p-1.5" />
        ) : (
          <div className="w-14 h-14 md:w-20 md:h-20 rounded-lg bg-white/10" />
        )}
        <div>
          <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] md:tracking-[0.3em] text-muted-foreground">Scan to Join</div>
          <div className="font-display font-black text-lg md:text-2xl text-foreground mt-0.5 md:mt-1">Join the Game</div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="text-center">
          <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] md:tracking-[0.3em] text-muted-foreground">Invite Code</div>
          <div className="font-display font-black text-2xl md:text-4xl tracking-[0.15em] md:tracking-[0.2em] text-[color:var(--neon-blue)] mt-0.5 md:mt-1">
            {game.invite_code}
          </div>
        </div>
        <div className="hidden sm:block h-10 md:h-12 w-px bg-border" />
        <div className="hidden sm:block text-center">
          <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] md:tracking-[0.3em] text-muted-foreground">Or Visit</div>
          <div className="font-mono font-bold text-sm md:text-lg text-[color:var(--neon-green)] mt-0.5 md:mt-1 truncate max-w-[180px] md:max-w-none">{shortUrl}</div>
        </div>
      </div>
    </div>
  );
}

function shortTeam(name: string) {
  if (!name) return "—";
  return name.length <= 4 ? name.toUpperCase() : name.slice(0, 3).toUpperCase();
}

export function fireConfetti() {
  const end = Date.now() + 8000;
  const colors = ["#3b9eff", "#5dffa1", "#ffb35a", "#ffffff"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 75, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 75, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
