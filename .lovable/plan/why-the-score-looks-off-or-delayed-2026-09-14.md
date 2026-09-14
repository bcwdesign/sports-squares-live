# Why the score looks off or delayed

## What the data shows

I checked the live games and the recorded score history.

- Updating is working. Tonight's DAL @ NYG boards were last refreshed about 2 seconds before I looked, and there were no errors recorded.
- The score feed itself is the problem. In the Washington/Philadelphia game the feed sent this sequence within a few minutes:

```text
22:53  17 - 9    15:00 4th
23:04  17 - 16    9:59 4th
23:06  17 - 15    9:59 4th   <- went backwards
23:07  17 - 16    9:59 4th
23:14  24 - 16    6:02 4th
23:15  17 - 16    7:29 4th   <- went backwards, clock went backwards too
23:18  24 - 16    5:56 4th
```

So the provider briefly reports a stale, lower score, then corrects itself. We save whatever it sends, so viewers see the score bounce and occasionally sit behind the TV broadcast. The feed also trails live TV by its own amount, which we cannot remove.

## What I propose

1. Ignore backwards updates. If the feed reports a lower score or an earlier clock within the same quarter, skip it instead of writing it. Accept a decrease only when the quarter resets or the game is marked final (genuine corrections).
2. Require confirmation for a drop. If the lower value repeats on the next check, treat it as a real correction and apply it, so a genuine scoring correction still lands within about a minute.
3. Show freshness. Display a small "updated X seconds ago" marker next to the score on the live and overlay screens so people can tell the board is alive even when nothing changes.
4. Leave winners alone until the quarter snapshot fires, which already happens at quarter end, so a flicker can never crown the wrong square.

## Technical details

- All logic goes in `doSync` in `src/lib/balldontlie.server.ts`, before the `games` update.
- Regression test: incoming `home_score + away_score` lower than stored total, or same `period` with a larger remaining clock. On regression, record the candidate (in the existing in-memory map keyed by game id) and skip the write; apply on second consecutive identical regression, or when `status_state === "final"`, or when `period` increases.
- Skipped polls still update `last_score_sync_at` so the freshness marker stays accurate, and log a `[score-sync] ignored-regression` line.
- No schema change. `score_events` keeps only the accepted values, so the recap history stops showing bounces.
- Freshness marker reads the existing `last_score_sync_at` field; no new data needed.

## What this will not fix

The provider's own lag behind live TV stays. We can only stop the bouncing and make the delay visible.
