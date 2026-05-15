# Match the spoken voice to the HeyGen avatar voice

## Problem
Right now `CommentatorCard.tsx` reads each new commentary line aloud using the browser's built-in `speechSynthesis` (tuned only by rate/pitch from `voice_style`). That voice has no relationship to the HeyGen voice the avatar uses in the intro/final-recap videos, so the live spoken line and the avatar video sound like two different people.

## Goal
When a new `commentator_latest_text` arrives and the user has unmuted, the audio that plays should use the **same HeyGen voice ID** that's assigned to the selected personality (from `src/lib/commentators.ts`).

## Approach
HeyGen exposes a Text-to-Speech endpoint (`POST https://api.heygen.com/v2/audio/generate`, voice-only, no avatar render) that returns an audio URL using a given `voice_id`. It's much faster and cheaper than a full avatar video — appropriate for short live lines.

We'll add a new server function that returns a signed audio URL for a given commentary line + game, and have the card play that audio instead of using `speechSynthesis`.

### 1. New server function — `generateCommentatorVoiceClip`
File: `src/server/commentator.functions.ts`

- Input: `{ gameId: string, text: string }`
- Auth: `requireSupabaseAuth` + `assertHost` (same as existing fns)
- Resolve `voice_id` the same way `generateHeyGenCommentatorVideo` does:
  `game.heygen_voice_id || preset?.heygenVoiceId || DEFAULT_HEYGEN_VOICE_ID`
- Call HeyGen's audio generation endpoint with `{ voice_id, input_text: text }`
- Return `{ audio_url: string }`
- On HeyGen error, return `{ audio_url: null, error }` (recoverable — card will fall back to muted/silent)

### 2. Update `CommentatorCard.tsx`
- Remove the `speechSynthesis` block and the `VOICE_STYLE_MAP`.
- Add a hidden `<audio ref={audioRef} />` element.
- When `commentator_latest_text` changes AND `!muted` AND text differs from `lastSpokenRef`:
  - Call the new server fn via `useServerFn`
  - On success, set `audioRef.current.src = audio_url` and `.play()`
  - Track `lastSpokenRef` to avoid repeats
- Mute toggle pauses the audio element instead of cancelling speechSynthesis.
- Keep all existing visual layout, status pill, recap progress UI exactly as is.

### 3. Notes / non-goals
- Final recap and intro continue to use the existing avatar video flow (already voice-correct).
- We do NOT persist the per-line audio URL to the DB — it's generated on demand client-side. (Tradeoff: a viewer reloading mid-line won't hear the previous line, which matches current behavior.)
- No DB migration, no UI layout changes, no changes to commentator presets.

## Files touched
- `src/server/commentator.functions.ts` — add `generateCommentatorVoiceClip`
- `src/components/CommentatorCard.tsx` — swap TTS for HeyGen audio playback

## Open question
HeyGen's TTS endpoint requires the same `HEYGEN_API_KEY` already configured — no new secret needed. If for some reason the workspace's HeyGen plan doesn't include the audio-only endpoint, we'd fall back to either (a) a short avatar video per line (expensive/slow) or (b) keeping browser TTS as a fallback. I'll implement with graceful fallback to silence + a console warning so the UI never breaks.
