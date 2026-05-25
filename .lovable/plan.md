## Goal

- Routine commentary (every 90s + on score updates) speaks via the browser's built-in TTS — no HeyGen call, no render wait, no API cost.
- At the end of each quarter and at the final buzzer, also kick off a HeyGen avatar video. While HeyGen renders, the same commentary line plays through TTS so viewers aren't waiting in silence.
- The existing final recap video flow (and the in-card video player) keeps working exactly as it does today.

## Changes

### 1. `src/components/CommentatorCard.tsx`
- Replace the HeyGen voice-clip effect (`generateCommentatorVoiceClip` + `getCommentatorVoiceClipStatus` polling + hidden `<audio>` element) with the browser Web Speech API (`window.speechSynthesis` + `SpeechSynthesisUtterance`).
- When `commentator_latest_text` changes and the card is unmuted, cancel any in-flight utterance and speak the new line. Pick a voice loosely matched to `commentator_voice_style` (deep / professional / energetic / funny / dramatic → rate + pitch tweaks; pick first matching `window.speechSynthesis.getVoices()` entry when possible).
- On mute toggle or unmount, call `speechSynthesis.cancel()`.
- Drop the `voiceLoading` spinner (no async render to wait for) and the `invokeAuthed` import. Keep the mute/unmute button and all visual layout.
- **Do not touch** the `<video src={game.heygen_video_url} …>` block or the "Rendering final recap video…" progress UI — that path is what shows the end-of-game HeyGen video.

### 2. `src/lib/commentator.functions.ts`
- Extend the `kind` enum on `generateHeyGenCommentatorVideo` from `["intro","final"]` to `["intro","quarter","final"]`.
- For `kind: "quarter"`, build the script from the current `commentator_latest_text` (fallback: a short generic "End of quarter N — {away_team} {score}, {home_team} {score}" line). Title: `"{commentator_name} Q{n} Recap"`.
- Final/intro behavior unchanged.

### 3. `src/routes/_app.game.$gameId.overlay.tsx`
- Change the periodic interval from **180s → 90s**.
- Keep the host-only throttled `generateScoreCommentary` trigger on score/quarter/status changes (this populates `commentator_latest_text`, which TTS will then read).
- Add a new effect: when `game.quarter` advances (using the existing `prevQuarterRef` signal) AND `heygen_reactions_enabled`, fire `generateScoreCommentary` first, then `generateHeyGenCommentatorVideo({ kind: "quarter" })`, then poll `getHeyGenVideoStatus` like the final-recap effect does. Guard with a `lastQuarterKickedRef` so it fires once per quarter transition.
- Leave the existing `status === "completed"` → `kind: "final"` effect untouched.

## Result

- Talk track is continuous (TTS speaks each new line instantly).
- Quarter breaks and the final buzzer still produce a HeyGen avatar video that lands in the same `heygen_video_url` slot the card already renders.
- No schema changes, no new secrets, no server-only code moved.
