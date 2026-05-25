// AI Commentator card shown on the live overlay. Renders HeyGen video when
// available, otherwise an avatar placeholder, the latest commentary line,
// and a status pill. Routine commentary plays via the browser Web Speech
// API (TTS). End-of-quarter / end-of-game HeyGen videos still appear in the
// inline video player when their URLs land via realtime.
import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/types";
import { enqueueCommentary, stopAllCommentary } from "@/lib/clutchcaster-tts";

type Props = {
  game: Game & {
    commentator_enabled?: boolean | null;
    commentator_name?: string | null;
    commentator_personality?: string | null;
    commentator_voice_style?: string | null;
    commentator_latest_text?: string | null;
    commentator_status?: string | null;
    heygen_video_url?: string | null;
    heygen_video_status?: string | null;
    heygen_reactions_enabled?: boolean | null;
  };
  /** Default true so the overlay starts silent (autoplay restrictions). */
  defaultMuted?: boolean;
};

export function CommentatorCard({ game, defaultMuted = true }: Props) {
  const enabled = !!game.commentator_enabled;
  const [muted, setMuted] = useState(defaultMuted);
  const lastSpokenRef = useRef<string | null>(null);
  const prevScoreRef = useRef<{ home: number; away: number } | null>(null);
  const prevQuarterRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  // Speak new commentary lines via ElevenLabs (with browser TTS fallback),
  // routed through the throttled/prioritized queue so we never overlap or spam.
  useEffect(() => {
    if (!enabled || muted) return;
    const text = game.commentator_latest_text?.trim();
    if (!text || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    // Infer priority from what changed since the last render.
    let priority: "winner" | "score" | "quarter" | "hype" = "hype";
    if (prevStatusRef.current && prevStatusRef.current !== "completed" && game.status === "completed") {
      priority = "winner";
    } else if (
      prevScoreRef.current &&
      (prevScoreRef.current.home !== game.home_score || prevScoreRef.current.away !== game.away_score)
    ) {
      priority = "score";
    } else if (prevQuarterRef.current !== null && game.quarter !== prevQuarterRef.current) {
      priority = "quarter";
    }
    prevScoreRef.current = { home: game.home_score, away: game.away_score };
    prevQuarterRef.current = game.quarter;
    prevStatusRef.current = game.status;

    enqueueCommentary(text, priority, { styleHint: game.commentator_voice_style });
  }, [
    enabled,
    muted,
    game.commentator_latest_text,
    game.commentator_voice_style,
    game.home_score,
    game.away_score,
    game.quarter,
    game.status,
  ]);

  // Stop playback when muted or unmounted.
  useEffect(() => {
    if (muted) stopAllCommentary();
  }, [muted]);
  useEffect(() => () => stopAllCommentary(), []);

  if (!enabled) return null;

  const status = (game.commentator_status || "ready").toUpperCase();
  const initials = (game.commentator_name || "AI")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const statusColor =
    status === "SPEAKING" || status === "LIVE"
      ? "bg-[color:var(--neon-green)] text-background"
      : status === "THINKING"
        ? "bg-[color:var(--neon-orange)] text-background animate-pulse"
        : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-2xl border-2 border-[color:var(--neon-blue)]/40 bg-[color:var(--surface)]/90 backdrop-blur-sm p-3 md:p-4 shadow-[var(--shadow-card)] mb-3 md:mb-4">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <Mic className="w-3 h-3 text-[color:var(--neon-blue)]" /> AI Commentator
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute commentator" : "Mute commentator"}
          className="p-1 rounded-md border border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-start gap-3">
        {game.heygen_video_url ? (
          <video
            src={game.heygen_video_url}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover bg-black"
          />
        ) : (
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-display font-black text-xl md:text-2xl text-background flex-shrink-0"
            style={{ backgroundImage: "var(--gradient-neon)" }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm md:text-base leading-tight truncate">
            {game.commentator_name || "AI Commentator"}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
            {game.commentator_personality || "Hype Announcer"}
          </div>
          <div className={cn("inline-block mt-1.5 px-1.5 py-0.5 rounded font-mono text-[9px] tracking-widest font-bold", statusColor)}>
            {status}
          </div>
        </div>
      </div>

      {(() => {
        const vStatus = (game.heygen_video_status || "").toLowerCase();
        const isFinal = game.status === "completed";
        const showRecapProgress =
          isFinal &&
          !!game.heygen_reactions_enabled &&
          !game.heygen_video_url &&
          (vStatus === "" || vStatus === "processing" || vStatus === "pending" || vStatus === "waiting" || vStatus === "unknown");
        const failed = vStatus.startsWith("error") || vStatus.startsWith("failed");
        if (!isFinal || !game.heygen_reactions_enabled) return null;
        if (showRecapProgress) {
          return (
            <div className="mt-2 md:mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 px-2.5 py-1.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)] truncate">
                Rendering final recap video… {vStatus ? `(${vStatus})` : "(queued)"}
              </div>
            </div>
          );
        }
        if (failed) {
          return (
            <div className="mt-2 md:mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive truncate">
              Recap video failed ({vStatus})
            </div>
          );
        }
        return null;
      })()}

      <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-border/60">
        <p className="text-xs md:text-sm text-foreground/90 leading-snug min-h-[2.5em]">
          {game.commentator_latest_text || "Waiting for tipoff. Your AI commentator is ready."}
        </p>
      </div>
    </div>
  );
}
