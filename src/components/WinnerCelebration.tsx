// Winner Celebration Engine
//
// Reusable, sports-broadcast style celebration overlay. Triggers when a
// winning square is determined after a score update. Used on:
//   - /game/:id/live           (compact)
//   - /game/:id/overlay        (TV-friendly, scaled visuals)
//
// The engine is purely presentational. The parent provides:
//   - winnerKey: a stable string identifying the current winner state
//     (e.g. "<quarter>:<owner_id>"). When this changes, the celebration
//     animation re-fires.
//   - replayKey: an optional integer the host can bump to force a replay
//     even when the winner identity hasn't changed.
//
// Total celebration runtime ~8s: confetti burst + slide-in card.
// Animations stop after that and the card auto-dismisses.

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, X } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";

export type WinnerInfo = {
  ownerName: string;
  ownerAvatarUrl?: string | null;
  homeDigit: number;
  awayDigit: number;
  homeTeam: string;
  awayTeam: string;
  quarter: number;
};

export type WinnerCelebrationProps = {
  winner: WinnerInfo | null;
  /** Key that changes when the winner identity changes (e.g. `${quarter}:${ownerId}`). */
  winnerKey: string;
  /** Bumping this forces a replay even when winnerKey is unchanged. */
  replayKey?: number;
  /** "compact" for in-page (live), "tv" for the overlay route. */
  variant?: "compact" | "tv";
  /** Whether to play the celebratory sound effect. Defaults true; respects autoplay rules. */
  sound?: boolean;
};

const CELEBRATION_MS = 8000;

export function WinnerCelebration({
  winner,
  winnerKey,
  replayKey = 0,
  variant = "compact",
  sound = true,
}: WinnerCelebrationProps) {
  const [active, setActive] = useState(false);
  const [shown, setShown] = useState<WinnerInfo | null>(null);
  const lastKey = useRef<string>("");
  const lastReplay = useRef<number>(replayKey);
  const isFirst = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger on winnerKey change (after the first render to avoid firing on mount
  // for a game that already had a winner) OR when replayKey changes.
  useEffect(() => {
    if (!winner) {
      lastKey.current = winnerKey;
      isFirst.current = false;
      return;
    }
    const replayBumped = replayKey !== lastReplay.current;
    const keyChanged = !isFirst.current && winnerKey !== lastKey.current;
    lastKey.current = winnerKey;
    lastReplay.current = replayKey;
    isFirst.current = false;

    if (!keyChanged && !replayBumped) return;

    setShown(winner);
    setActive(true);
    fireConfetti();
    if (sound) playWinnerSound();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(false), CELEBRATION_MS);
  }, [winnerKey, replayKey, winner, sound]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active || !shown) return null;

  const isTv = variant === "tv";

  return (
    <div
      className={cn(
        "fixed z-[70] pointer-events-none",
        isTv
          ? "top-1/2 right-12 -translate-y-1/2"
          : "top-20 right-4 sm:right-6 max-w-[calc(100vw-2rem)]",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto rounded-2xl border-2 shadow-2xl backdrop-blur-md animate-celebration-slide-in",
          "border-[color:var(--neon-orange)] bg-background/95",
          isTv ? "p-8 w-[420px]" : "p-4 sm:p-5 w-[320px]",
        )}
        style={{ boxShadow: "var(--shadow-neon-orange)" }}
      >
        {/* Close (manual dismiss) */}
        <button
          onClick={() => setActive(false)}
          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
          aria-label="Dismiss"
        >
          <X className={isTv ? "w-5 h-5" : "w-3.5 h-3.5"} />
        </button>

        {/* Quarter label */}
        <div className="flex items-center gap-2">
          <Trophy
            className={cn(
              "text-[color:var(--neon-orange)]",
              isTv ? "w-6 h-6" : "w-4 h-4",
            )}
          />
          <span
            className={cn(
              "font-mono uppercase tracking-[0.3em] text-[color:var(--neon-orange)] font-bold",
              isTv ? "text-sm" : "text-[10px]",
            )}
          >
            Q{shown.quarter} Winner
          </span>
        </div>

        {/* Avatar with bounce + glow ring */}
        <div className={cn("flex justify-center", isTv ? "my-6" : "my-4")}>
          <div className="animate-celebration-avatar">
            <PlayerAvatar
              name={shown.ownerName}
              src={shown.ownerAvatarUrl}
              size={isTv ? "2xl" : "xl"}
              ring
              glow
            />
          </div>
        </div>

        {/* Player name */}
        <div
          className={cn(
            "font-display font-black text-center leading-tight truncate",
            isTv ? "text-4xl" : "text-2xl",
          )}
        >
          {shown.ownerName}
        </div>

        {/* Tagline */}
        <div
          className={cn(
            "font-mono uppercase tracking-[0.3em] text-center text-[color:var(--neon-green)] mt-2",
            isTv ? "text-sm" : "text-[10px]",
          )}
        >
          Clutch Hit!
        </div>

        {/* Winning digits */}
        <div
          className={cn(
            "flex items-center justify-center gap-3 mt-4",
            isTv && "mt-6",
          )}
        >
          <DigitChip digit={shown.awayDigit} label={shortTeam(shown.awayTeam)} color="var(--neon-blue)" big={isTv} />
          <span
            className={cn(
              "font-mono font-black text-muted-foreground",
              isTv ? "text-3xl" : "text-xl",
            )}
          >
            ×
          </span>
          <DigitChip digit={shown.homeDigit} label={shortTeam(shown.homeTeam)} color="var(--neon-green)" big={isTv} />
        </div>
      </div>
    </div>
  );
}

function DigitChip({
  digit,
  label,
  color,
  big,
}: {
  digit: number;
  label: string;
  color: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "rounded-xl flex items-center justify-center font-mono font-black tabular-nums",
          big ? "w-16 h-16 text-3xl" : "w-12 h-12 text-xl",
        )}
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`,
          color,
          border: `2px solid ${color}`,
          boxShadow: `0 0 16px color-mix(in oklab, ${color} 40%, transparent)`,
        }}
      >
        {digit}
      </div>
      <div
        className={cn(
          "font-mono uppercase tracking-widest text-muted-foreground mt-1",
          big ? "text-[11px]" : "text-[9px]",
        )}
      >
        {label}
      </div>
    </div>
  );
}

function shortTeam(name: string) {
  if (!name) return "—";
  return name.length <= 4 ? name.toUpperCase() : name.slice(0, 3).toUpperCase();
}

// ---------- Confetti ----------

export function fireConfetti() {
  const end = Date.now() + 4000;
  const colors = ["#3b9eff", "#5dffa1", "#ffb35a", "#ffffff"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ---------- Sound ----------
//
// Lightweight, library-free, asset-free celebratory chord using the Web Audio
// API. Plays once. Browsers may block audio without prior user interaction;
// we silently swallow the rejection in that case.

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playWinnerSound() {
  const ctx = getCtx();
  if (!ctx) return;
  // Resume if suspended (autoplay policy); ignore failure.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;

  // Stadium-style "ding-ding-DING" chord cluster.
  const notes = [
    { freq: 523.25, t: 0.0, dur: 0.18 }, // C5
    { freq: 659.25, t: 0.12, dur: 0.18 }, // E5
    { freq: 783.99, t: 0.24, dur: 0.55 }, // G5
    { freq: 1046.5, t: 0.24, dur: 0.55 }, // C6 (octave above for sparkle)
  ];

  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = n.freq;
    gain.gain.setValueAtTime(0.0001, now + n.t);
    gain.gain.exponentialRampToValueAtTime(0.6, now + n.t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.dur);
    osc.connect(gain).connect(master);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.dur + 0.05);
  }
}
