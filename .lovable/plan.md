# Fix: finished recap video never appears on the Game Over page

## What happened with DAL @ NYG

The recap video for that game **was** created successfully at HeyGen. The app just never
recorded that it finished, so the Game Over page is still stuck on "Rendering final recap video…".

Two problems, confirmed against the live data:

1. The background job that checks "is the video done yet?" only looks at games **created**
   in the last 6 hours. That cutoff was meant to stop old boards from being re-rendered, but it
   was also applied to the checking step. The DAL @ NYG board was created days before it
   finished, so it was skipped every minute and the finished video was never saved.
   (Same situation for WSH @ PHI and several older boards, all stuck at "processing".)
2. A video that was requested from the host's own screen is only tracked while that screen
   stays open. Once the host navigates away, nothing checks on it again.

## The fix

1. **Check by when the game finished, not when it was created.** The "is it done yet?" pass
   will look at games whose recap was requested in the last 48 hours, regardless of when the
   board was created. The separate "start a new recap" pass keeps its strict recency guard, so
   no old board ever gets a new video billed.
2. **Stop giving up on in-flight videos.** Anything still waiting on a video keeps getting
   checked each minute until it completes or errors out, with a cap so a permanently stuck
   render doesn't get polled forever.
3. **Recover the already-finished videos.** Run the check once for the boards currently stuck
   at "processing" (including DAL @ NYG) so their finished videos get attached and appear on
   the Game Over page. This only reads from HeyGen — no new videos are created.
4. **Keep the page honest while waiting.** The Game Over page will check for the recap every
   20 seconds while it shows "Rendering…", so it fills in on its own instead of needing a
   refresh. The existing host Retry button stays as-is.

## Technical notes

- `src/lib/commentator.server.ts` → `runDueFinalRecaps()`: drop the `created_at` cutoff from the
  pending-poll query; replace with `heygen_final_requested_at >= now() - 48h OR
  heygen_final_requested_at is null` scoped to `status = 'completed'`, `heygen_video_id not null`,
  `heygen_video_url is null`. Raise the poll limit to 25. The request pass keeps its 6-hour
  `created_at` gate and limit of 5.
- One-off recovery: call `pollHeyGenVideo(gameId)` for the currently stuck games via the cron
  endpoint after the query change (no new HeyGen renders).
- `src/routes/_app.game.$gameId.results.tsx`: when `commentator_enabled && !heygen_video_url &&
  !failed`, start a 20s interval calling `getHeyGenVideoStatus`; clear on unmount, on URL arrival,
  or after ~30 ticks. Realtime on `games` already pushes the row update once the URL lands.
