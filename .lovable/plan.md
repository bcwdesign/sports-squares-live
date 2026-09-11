# Keep scores updating after the host leaves the page

## What's happening

The app already has a background job that is supposed to refresh scores every minute, whether or not anyone has the game open. It is running on schedule, but every single run is being turned away by the app.

Verified just now:
- The scheduled job fires every minute and reports success on the database side.
- Every response coming back from the app for the last runs is: `503 Service unavailable: CRON_SECRET not configured`.

So scores only move while the host (or someone on the overlay) has a tab open, because that tab does its own updating. The moment they navigate away, nothing updates.

Two things are broken:
1. The shared password the background job is supposed to prove itself with was never created.
2. The scheduled job isn't sending that password with its request at all.

## The fix

1. Generate a secret value and store it with the app as `CRON_SECRET`.
2. Update the scheduled job so each request includes that secret in its header.
3. Confirm the next runs come back successful instead of 503, and that a connected live game's score advances with no browser tab open.

## Technical details

- Endpoint: `src/routes/api/public/hooks/sync-live-scores.ts` — fails closed on missing/mismatched `x-cron-secret`. No code change needed; behaviour is correct.
- Add secret `CRON_SECRET` (generated, not user-supplied) so the deployed worker can read `process.env.CRON_SECRET`.
- Reschedule pg_cron job `sync-live-scores-every-minute` so the `net.http_post` headers include `{"Content-Type":"application/json","x-cron-secret":"<secret>"}`, keeping the existing `* * * * *` schedule and the stable production URL.
- Verify with `net._http_response` (expect `200` and a JSON body with `scanned`/`results`) and by checking `games.last_score_sync_at` advancing for an eligible game while no tab is open.
- Host-tab polling (`useLiveScoreAutoSync`) stays as-is; it is a faster foreground supplement, not the source of truth.
