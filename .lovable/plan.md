# AI Commentator — Implementation Plan

## Scope
Host opts in when creating a game. Live overlay shows a commentator card that speaks score/quarter/winning-square updates. Video avatar (HeyGen) is generated asynchronously when enabled.

## 1. Database (migration)
Add columns to `games`:
- `commentator_enabled bool default false`
- `commentator_name text`
- `commentator_personality text`
- `commentator_voice_style text`
- `commentator_catchphrases text`
- `commentator_intro_script text`
- `commentator_latest_text text`
- `commentator_latest_audio_url text`
- `commentator_last_spoken_at timestamptz`
- `commentator_status text default 'ready'` (ready|thinking|speaking|live)
- `heygen_intro_enabled bool default false`
- `heygen_reactions_enabled bool default false`
- `heygen_avatar_id text`, `heygen_voice_id text`
- `heygen_video_id text`, `heygen_video_status text`, `heygen_video_url text`

RLS: existing host-update / member-select policies on `games` already cover these.

## 2. Secrets
- Store `HEYGEN_API_KEY` via secrets tool (server-only). The key the user pasted in chat will be added through the secret form, not committed to source.

## 3. Create Game UI (`src/routes/_app.create.tsx`)
New collapsible section between Privacy and the action buttons, styled to match (dark card, neon accents, mono labels):
- Toggle: Enable AI Commentator
- When on:
  - Commentator Name (text)
  - Personality select (Hype Announcer / Trash Talk Uncle / ESPN Analyst / Twitch Streamer / Rival Fan / Family Friendly Host)
  - Voice Style select (Energetic / Deep Voice / Funny / Professional / Streetball / Dramatic)
  - Catchphrases (text)
  - Intro Script (textarea, auto-filled from name + teams + personality, editable)
  - Checkbox: Generate HeyGen intro video
  - Checkbox: Generate HeyGen halftime/final reaction clips

Save all fields with the game insert. After insert, if `heygen_intro_enabled`, fire-and-forget `generateHeyGenCommentatorVideo({ gameId })`.

## 4. Server functions (`src/lib/commentator.functions.ts`)
All authed via `requireSupabaseAuth`; host-only checks via `is_game_host`.

- `generateScoreCommentary({ gameId })`
  - Loads game + squares + players, computes current winning square via existing `winningSquareIndex` logic.
  - Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with a prompt built from personality + voice style + catchphrases + score state. Strict no-gambling guardrail in the system prompt.
  - Updates `commentator_latest_text`, `commentator_last_spoken_at`, `commentator_status='live'`.

- `generateHeyGenCommentatorVideo({ gameId })`
  - Reads game; uses saved `heygen_avatar_id`/`heygen_voice_id` or hardcoded MVP defaults.
  - POST to `https://api.heygen.com/v2/video/generate` with the documented payload (the spec says `/v3/videos`; HeyGen's current public endpoint is v2 — use v2, this is the working endpoint).
  - Saves `heygen_video_id` + `heygen_video_status='processing'`.

- `getHeyGenVideoStatus({ gameId })`
  - GETs HeyGen status; on `completed`, saves `heygen_video_url` + status.

## 5. Overlay card (`src/components/CommentatorCard.tsx`)
- Renders inside `src/routes/_app.game.$gameId.overlay.tsx` (and the in-page live overlay) above the existing winning-square area.
- Hidden when `commentator_enabled=false`.
- Shows: title, avatar (HeyGen `<video>` autoplay+muted+controls if `heygen_video_url`, else circular initials), name, personality, status pill, latest commentary text, mute/unmute button.
- Subscribes to game realtime (already wired by `useGame`) — re-renders when `commentator_latest_text` changes.

## 6. TTS + trigger loop (in overlay components)
- Web `SpeechSynthesis`. Voice style maps to `{ rate, pitch }`.
- Default muted; mute button toggles. Skip if `speaking` or muted.
- Speak whenever `commentator_latest_text` changes and ≥30s since last spoken.

Host-side trigger (only the host's overlay tab calls the server fn, to avoid duplication):
- On game start (`status` → `live`), score change, quarter change, every 60s during live, and on `completed`.
- Debounced; minimum 30s between calls.

## 7. UI copy
- No score: "Waiting for tipoff. Your AI commentator is ready."
- Winning: `Currently winning: Square {homeDigit}-{awayDigit} — {playerName|Unclaimed}`

## Out of scope (MVP)
- Per-clip HeyGen reaction generation at quarter/final (toggle is saved; wiring deferred — text+TTS still fires).
- Server-side scheduler. The 60s loop runs in the host's overlay tab while open.

## Files
- migration (new)
- `src/routes/_app.create.tsx` (edit)
- `src/lib/commentator.functions.ts` (new)
- `src/components/CommentatorCard.tsx` (new)
- `src/routes/_app.game.$gameId.overlay.tsx` (edit)
- `src/routes/_app.game.$gameId.live.tsx` (edit — embed card in in-page overlay)

## Confirm before I build
1. Add `HEYGEN_API_KEY` as a server secret via the secrets prompt? (The key you pasted should not live in source — I'll request it through the secure form.)
2. OK to use HeyGen API v2 (`/v2/video/generate`) instead of `/v3/videos` from the spec? v3 isn't a public endpoint.
3. OK to defer per-quarter HeyGen reaction clips for MVP (toggle saved, only intro video generates) and rely on text+browser TTS for live commentary?
