// AI Commentator card shown on the live overlay. Renders HeyGen video when
// available, otherwise an avatar placeholder, the latest commentary line,
// and a status pill. When unmuted, each new commentary line is spoken using
// the SAME HeyGen voice the avatar uses (via a short rendered voice clip).
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/types";
import { invokeAuthed } from "@/lib/serverFnClient";
import {
  generateCommentatorVoiceClip,
  getCommentatorVoiceClipStatus,
} from "@/server/commentator.functions";

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
  const [voiceLoading, setVoiceLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestedTextRef = useRef<string | null>(null);
  const activeJobRef = useRef<{ text: string; videoId: string } | null>(null);

  // When a new commentary line arrives and we're unmuted, render it through
  // HeyGen with the avatar's voice and play just the audio.
  useEffect(() => {
    if (!enabled || muted) return;
    const text = game.commentator_latest_text?.trim();
    if (!text || text === requestedTextRef.current) return;
    requestedTextRef.current = text;

    let cancelled = false;
    setVoiceLoading(true);

    (async () => {
      try {
        const gen = await invokeAuthed(generateCommentatorVoiceClip, {
          gameId: game.id,
          text,
        });
        if (cancelled) return;
        if (!gen?.ok || !gen.video_id) {
          setVoiceLoading(false);
          return;
        }
        activeJobRef.current = { text, videoId: gen.video_id };

        // Poll up to ~90s for the clip to render.
        const start = Date.now();
        while (!cancelled && Date.now() - start < 90_000) {
          // If a newer line came in, abandon this one.
          if (requestedTextRef.current !== text) return;
          await new Promise((r) => setTimeout(r, 3000));
          const s = await invokeAuthed(getCommentatorVoiceClipStatus, {
            gameId: game.id,
            videoId: gen.video_id,
          });
          if (cancelled) return;
          if (s?.status === "completed" && s.url) {
            if (requestedTextRef.current !== text) return;
            const el = audioRef.current;
            if (el) {
              el.src = s.url;
              el.play().catch(() => {
                /* autoplay may still be blocked; user can unmute again */
              });
            }
            break;
          }
          if (s?.status && (s.status.startsWith("failed") || s.status.startsWith("error"))) {
            break;
          }
        }
      } catch (err) {
        console.warn("Commentator voice clip failed", err);
      } finally {
        if (!cancelled) setVoiceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, muted, game.id, game.commentator_latest_text]);

  // Stop playback immediately when muted.
  useEffect(() => {
    if (muted && audioRef.current) {
      audioRef.current.pause();
    }
  }, [muted]);

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
          {voiceLoading && !muted && (
            <Loader2 className="w-3 h-3 animate-spin text-[color:var(--neon-orange)]" />
          )}
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
              <Loader2 className="w-3.5 h-3.5 text-[color:var(--neon-orange)] animate-spin shrink-0" />
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

      {/* Hidden audio element plays the HeyGen-rendered voice clip. */}
      <audio ref={audioRef} hidden preload="auto" />
    </div>
  );
}
