## Goal

Confetti and the WinnerCelebration card currently fire every time the *currently winning* square changes — including mid-quarter score updates. Change the trigger so it only fires when:

1. **A quarter ends** — i.e. `game.quarter` advances (the score that was on the board for the just-completed quarter is the winning score), OR
2. **The game ends** — i.e. `game.status` becomes `completed`.

The host's manual "Replay celebration" button (overlay route) keeps working unchanged.

## Approach

Introduce a new prop `triggerKey` on `WinnerCelebration` that callers compute. The component fires confetti + shows the card only when `triggerKey` changes (plus the existing `replayKey` for manual replay). Drop the existing "fire whenever the winning owner changes mid-quarter" behavior.

Callers compute `triggerKey` from "settled" milestones only:
- Track `previousQuarter` (via ref). When `game.quarter` increases, snapshot the *previous* quarter's winner — that's what to celebrate.
- When `game.status === "completed"`, celebrate the final quarter's winner.
- Otherwise, no celebration.

Same logic in the in-page Overlay's confetti effect (`src/components/Overlay.tsx`).

## Files to change

**`src/components/WinnerCelebration.tsx`**
- Replace the `winnerKey` change-detection effect with one keyed off a new `triggerKey: string` prop. Keep `replayKey` for forced replays.
- Remove the "first render skip" logic — trigger only fires when the parent decides a milestone occurred.

**`src/routes/_app.game.$gameId.live.tsx`** (around lines 383–440)
- Add a ref tracking last seen `quarter` and last seen `status`.
- Maintain a `celebrated` state holding `{ winnerInfo, triggerKey }` for the most recent milestone (quarter advance or completion).
- Effect: when `quarter` increases, compute the winner from the score at that moment (already in `game` because the live sync persists score before advancing — confirm; if not, we capture pre-advance via a ref of the last winnerInfo and emit it on the advance). Likely simplest: keep `lastWinnerInfoRef` updated each render with current `winnerInfo`; on quarter advance, set `celebrated` to that snapshot with `triggerKey = "q{prevQuarter}"`. On `status === "completed"`, set `celebrated` with `triggerKey = "final"`.
- Pass `celebrated.winnerInfo` and `celebrated.triggerKey` to `<WinnerCelebration>`.
- Remove the toast that says "X now winning!" on every mid-quarter lead change (it's the same noise the user is asking to silence). Keep an optional toast on the milestone events.

**`src/routes/_app.game.$gameId.overlay.tsx`** (around lines 50–115)
- Same milestone/snapshot logic as above. Pass `triggerKey` instead of `winnerKey`.

**`src/components/Overlay.tsx`** (lines 34–53)
- Replace the "fire when winner identity changes" effect with milestone detection (quarter advance or `status === "completed"`). Keep the `replayKey` effect intact.

## Edge cases

- If the host manually edits the score after a quarter has ended (correction), no new celebration — the trigger only fires on a *new* milestone.
- If a game starts already in Q2+ (mid-game join), the initial render does **not** celebrate; trigger only fires on subsequent advances/completion.
- Manual "Replay celebration" button on the overlay still works via `replayKey`.

## Out of scope

- No DB schema changes.
- No change to how scores/quarters are written by the live sync function — only the celebration trigger conditions on the client change.