// Server route: streams ElevenLabs TTS audio back to the browser as audio/mpeg.
//
// SECURITY: ELEVENLABS_API_KEY is read from process.env on the server only.
// It is never sent to the browser. The route returns raw MP3 bytes so the
// frontend can play them via `new Audio()` and revoke the object URL on end.
//
// To swap voices, change DEFAULT_ELEVENLABS_VOICE_ID below or set the
// ELEVENLABS_VOICE_ID environment variable on the server.
import { createFileRoute } from "@tanstack/react-router";

// ============================================================================
// PASTE YOUR ELEVENLABS VOICE ID HERE (server-side default).
// Per-request `voiceId` from the client overrides this when allowed.
// The ELEVENLABS_API_KEY itself must be stored as an environment variable on
// the server (Lovable Cloud → Secrets), NEVER in source code.
// ============================================================================
const DEFAULT_ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "ZSH5meC9MStzFyNY6PCW";

// Voice IDs we let the client request. Add new IDs here as more voices are
// onboarded. For now every "style" routes to the same default voice but the
// structure is in place to diverge later.
const ALLOWED_VOICE_IDS = new Set<string>([DEFAULT_ELEVENLABS_VOICE_ID]);

export const Route = createFileRoute("/api/tts/elevenlabs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { text?: unknown; voiceId?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) {
          return Response.json({ error: "text is required" }, { status: 400 });
        }
        if (text.length > 300) {
          return Response.json(
            { error: "text must be 300 characters or fewer" },
            { status: 400 },
          );
        }

        const requestedVoice =
          typeof body.voiceId === "string" && ALLOWED_VOICE_IDS.has(body.voiceId)
            ? body.voiceId
            : DEFAULT_ELEVENLABS_VOICE_ID;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "ELEVENLABS_API_KEY is not configured" },
            { status: 500 },
          );
        }

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(requestedVoice)}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_flash_v2_5",
              voice_settings: {
                stability: 0.35,
                similarity_boost: 0.75,
                style: 0.85,
                use_speaker_boost: true,
                speed: 1.05,
              },
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("ElevenLabs TTS failed", upstream.status, detail.slice(0, 300));
          return Response.json(
            { error: `ElevenLabs ${upstream.status}` },
            { status: 502 },
          );
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
