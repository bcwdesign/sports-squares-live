# Final recap video generates in the background

Today the final game video only gets made if the host still has the live or overlay screen open when the game ends. This moves the final recap to the server so it is always produced, even with every browser closed.

Quarter videos and in-game spoken commentary stay as they are: they only run while a host or overlay screen is open.

## How it will work

1. The every-minute background job already scans connected games. It gains a second pass: any game that has just finished, has the AI commentator and reaction videos turned on, and has no final recap yet, gets one requested from HeyGen.
2. The same job checks back on in-flight recaps each minute and saves the finished video on the game, so the results page picks it up automatically.
3. Each game gets exactly one final recap. A marker on the game record makes the request run once and only once, whether it was started by the background job or by a host who happened to have the screen open.
4. If HeyGen fails, the error is recorded and the existing host "Retry" button on the results page still works.

## Cost

One extra video per completed game with the commentator enabled — the same number as today, just reliably produced instead of missed. For 10 boards ending on the same slate that is 10 final videos. No extra cost for games without the commentator turned on.

## Technical details

- `src/lib/commentator.server.ts`: extract the final-script build + HeyGen `POST /v2/video/generate` call from `generateHeyGenCommentatorVideo` into `generateFinalRecap(gameId)` (no auth context, uses `supabaseAdmin`), and the `video_status.get` poll from `getHeyGenVideoStatus` into `pollHeyGenStatus(gameId)`. Both server-only; the existing server functions call the same helpers so behaviour is unchanged for the host path.
- Migration: add `games.heygen_final_requested_at timestamptz` as the idempotency marker (set with a conditional `update ... is null` so concurrent host/cron attempts can't double-fire).
- New `runDueFinalRecaps()` in a `.server.ts` module: selects games where `status = 'completed'`, `commentator_enabled`, `heygen_reactions_enabled`, `heygen_final_requested_at is null` → generate; plus games where `heygen_video_status = 'processing'` and no `heygen_video_url` → poll. Bounded (e.g. 10 per run) so one cron tick stays fast.
- `src/lib/sync-live-scores.functions.ts`: call `runDueFinalRecaps()` alongside the existing `runDueRandomizations()` and include the counts in the response.
- Overlay/live pages keep their host-side final-recap kick (it is now idempotent via the marker) so hosts watching still get the video within seconds rather than up to a minute.
- Requires the published app to have `CRON_SECRET`, same as the score sync.
