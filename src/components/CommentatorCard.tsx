// AI Commentator card shown on the live overlay. Renders HeyGen video when
// available, otherwise an avatar placeholder, the latest commentary line,
// and a status pill. Mute/unmute toggles browser TTS.
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/types";

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

const VOICE_STYLE_MAP: Record<string, { rate: number; pitch: number }> = {
  Energetic: { rate: 1.15, pitch: 1.15 },
  "Deep Voice": { rate: 0.9, pitch: 0.6 },
  Funny: { rate: 1.1, pitch: 1.4 },
  Professional: { rate: 1.0, pitch: 1.0 },
  Streetball: { rate: 1.1, pitch: 1.1 },
  Dramatic: { rate: 0.95, pitch: 0.85 },
};

export function CommentatorCard({ game, defaultMuted = true }: Props) {
  const enabled = !!game.commentator_enabled;
  const [muted, setMuted] = useState(defaultMuted);
  const lastSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (muted) return;
    const text = game.commentator_latest_text?.trim();
    if (!text || text === lastSpokenRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking) return;
    lastSpokenRef.current = text;
    const u = new SpeechSynthesisUtterance(text);
    const tuning = VOICE_STYLE_MAP[game.commentator_voice_style || "Energetic"] || VOICE_STYLE_MAP.Energetic;
    u.rate = tuning.rate;
    u.pitch = tuning.pitch;
    window.speechSynthesis.speak(u);
  }, [enabled, muted, game.commentator_latest_text, game.commentator_voice_style]);

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

      <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-border/60">
        <p className="text-xs md:text-sm text-foreground/90 leading-snug min-h-[2.5em]">
          {game.commentator_latest_text || "Waiting for tipoff. Your AI commentator is ready."}
        </p>
      </div>
    </div>
  );
}
