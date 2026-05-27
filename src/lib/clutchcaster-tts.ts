// ClutchCaster TTS helper.
//
// playElevenLabsTTS(text)  — primary path. Fetches MP3 from our server route
//                            (which holds the ELEVENLABS_API_KEY) and plays
//                            it via a fresh <Audio> element. Falls back to
//                            playBrowserFallbackTTS on any failure.
// playBrowserFallbackTTS    — the previous browser-native SpeechSynthesis
//                            path, renamed and kept verbatim as a fallback.
//
// The module also exports a small throttled/prioritized queue so quick bursts
// of game events don't pile up: only the latest highest-priority line is
// actually voiced, with a 4s minimum gap between utterances.
//
// ============================================================================
// Voice Style → ElevenLabs Voice ID mapping.
// For now every style uses the same voice ID, but new IDs can be wired here.
// The server route's ALLOWED_VOICE_IDS must also include any new IDs.
// ============================================================================
export type ClutchVoiceStyle = "hype" | "calm" | "party";

export const CLUTCH_VOICE_ID_BY_STYLE: Record<ClutchVoiceStyle, string> = {
  hype: "ZSH5meC9MStzFyNY6PCW", // Hype Commentator — paste new voice IDs here
  calm: "ZSH5meC9MStzFyNY6PCW", // Calm Analyst
  party: "ZSH5meC9MStzFyNY6PCW", // Fun Watch Party Host
};

export const CLUTCH_VOICE_STYLE_LABEL: Record<ClutchVoiceStyle, string> = {
  hype: "Hype Commentator",
  calm: "Calm Analyst",
  party: "Fun Watch Party Host",
};

// Soft / hard character limits for sports-style one-liners.
const PREFERRED_MAX = 160;
const HARD_MAX = 300;

export function trimToCommentaryLine(input: string): string {
  const t = (input || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= PREFERRED_MAX) return t;
  // Try to cut at sentence boundary inside the preferred window.
  const slice = t.slice(0, PREFERRED_MAX);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (lastStop >= 60) return slice.slice(0, lastStop + 1);
  return t.slice(0, HARD_MAX);
}

// --- Browser fallback (formerly the only path) ------------------------------

function voiceParamsFor(style: string | null | undefined): { rate: number; pitch: number; prefer: RegExp | null } {
  const s = (style || "").toLowerCase();
  if (s.includes("deep")) return { rate: 0.92, pitch: 0.6, prefer: /male|daniel|fred/i };
  if (s.includes("professional") || s.includes("calm")) return { rate: 1.0, pitch: 1.0, prefer: /female|samantha|karen/i };
  if (s.includes("energetic") || s.includes("hype")) return { rate: 1.15, pitch: 1.15, prefer: null };
  if (s.includes("funny") || s.includes("party")) return { rate: 1.1, pitch: 1.3, prefer: null };
  if (s.includes("dramatic")) return { rate: 0.95, pitch: 0.85, prefer: /male/i };
  return { rate: 1.05, pitch: 1.0, prefer: null };
}

function pickBrowserVoice(prefer: RegExp | null): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  if (prefer) {
    const match = pool.find((v) => prefer.test(v.name));
    if (match) return match;
  }
  return pool[0] ?? null;
}

export function playBrowserFallbackTTS(text: string, styleHint?: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const { rate, pitch, prefer } = voiceParamsFor(styleHint);
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    const v = pickBrowserVoice(prefer);
    if (v) utter.voice = v;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}

// --- ElevenLabs primary path ------------------------------------------------

let currentAudio: HTMLAudioElement | null = null;

export async function playElevenLabsTTS(
  text: string,
  opts: { voiceId?: string; styleHint?: string | null } = {},
): Promise<void> {
  const line = trimToCommentaryLine(text);
  if (!line) return;

  try {
    // Attach the user's bearer token so the server route can verify
    // the caller is authenticated before consuming ElevenLabs credits.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("not authenticated");

    const res = await fetch("/api/tts/elevenlabs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text: line, voiceId: opts.voiceId }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("empty audio");

    const url = URL.createObjectURL(blob);
    // Stop any previous clip so commentary never overlaps.
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    await new Promise<void>((resolve) => {
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      audio.play().catch(() => cleanup());
    });
  } catch (err) {
    console.warn("ElevenLabs TTS failed, falling back to browser TTS", err);
    await playBrowserFallbackTTS(line, opts.styleHint);
  }
}

// --- Throttled, prioritized queue ------------------------------------------
//
// Priority: winner > score > quarter > hype. Only the latest highest-priority
// pending message is kept; older queued lines are dropped. Minimum 4s gap
// between actual utterances.

export type ClutchPriority = "winner" | "score" | "quarter" | "hype";

const PRIORITY_RANK: Record<ClutchPriority, number> = {
  winner: 4,
  score: 3,
  quarter: 2,
  hype: 1,
};

const MIN_GAP_MS = 4000;

let lastPlayedAt = 0;
let pending: { text: string; priority: ClutchPriority; voiceId?: string; styleHint?: string | null } | null = null;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;
let playing = false;

function schedulePump(delay: number) {
  if (pumpTimer) return;
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    void pump();
  }, Math.max(0, delay));
}

async function pump() {
  if (playing || !pending) return;
  const now = Date.now();
  const wait = lastPlayedAt + MIN_GAP_MS - now;
  if (wait > 0) {
    schedulePump(wait);
    return;
  }
  const next = pending;
  pending = null;
  playing = true;
  lastPlayedAt = Date.now();
  try {
    await playElevenLabsTTS(next.text, { voiceId: next.voiceId, styleHint: next.styleHint });
  } finally {
    playing = false;
    lastPlayedAt = Date.now();
    if (pending) schedulePump(MIN_GAP_MS);
  }
}

export function enqueueCommentary(
  text: string,
  priority: ClutchPriority,
  opts: { voiceId?: string; styleHint?: string | null } = {},
) {
  const line = trimToCommentaryLine(text);
  if (!line) return;
  // Drop if a higher-or-equal priority message is already pending and newer.
  if (pending && PRIORITY_RANK[pending.priority] > PRIORITY_RANK[priority]) return;
  pending = { text: line, priority, voiceId: opts.voiceId, styleHint: opts.styleHint };
  schedulePump(0);
}

export function stopAllCommentary() {
  pending = null;
  if (pumpTimer) {
    clearTimeout(pumpTimer);
    pumpTimer = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
