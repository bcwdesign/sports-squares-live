# NFL Pre-Game Randomization

Adds a fair "Randomized Before Kickoff" mode for NFL games only: players reserve a number of entries, and the server randomly assigns board positions and both teams' scoring digits shortly before kickoff. Every other sport and existing game keeps today's behavior.

## How it works for people

**Host, when creating an NFL game**
- New "Square Assignment" choice: *Manual Selection* (today's behavior, default for existing games) or *Randomized Before Kickoff*.
- If randomized: pick when it happens — 60 / 30 / 15 / 10 / 5 minutes before kickoff, or at kickoff. Default 10 minutes.
- Shown on the host screen: kickoff time, scheduled randomization time, squares claimed, players, status, and a **Randomize & Lock Board Now** button with a confirmation dialog. After locking, the button disappears and the host sees the randomization record (time, ID, squares assigned, team numbers confirmed).

**Players, before randomization**
- Tap "Reserve a square" instead of picking a cell. They see "Your Entries: 4" and "Your board positions and scoring numbers will be randomly assigned before kickoff."
- The board shows how many squares are claimed (e.g. 63/100) but no names or positions.
- A live countdown: "Board Randomizes In 01:42:18 — scheduled for 8:10 PM ET".

**At randomization**
- The server assigns positions and digits in one go and locks the board. Anyone with the page open sees it update on its own, with a short reveal sequence, then their own squares highlighted and listed (#7, #23, #61, #88).
- New entries stop being accepted once the board is locked.

**Resets**
- Only a deliberate, typed confirmation before kickoff can clear a randomized board, and it is recorded. No repeat-shuffle button.

## Technical notes

**Schema (additive migration)**
- `games`: `assignment_mode` text default `'manual'`, `randomization_minutes_before_kickoff` int default 10, `scheduled_randomization_at` timestamptz, `board_randomized` bool default false, `board_locked` bool default false, `randomized_at`, `randomized_by`, `randomization_version` int default 1.
- Reuse existing `home_axis` / `away_axis` as the two team digit arrays — no new `team_a_numbers` columns.
- Reuse existing `squares` rows for assignments; add `game_entries` (game_id, user_id, display_name, entry_count) to hold reserved entries before positions exist.
- New `board_randomizations` audit table: game_id, external_game_id, kickoff_at, scheduled_at, randomized_at, randomized_by, player_count, claimed_count, home_axis, away_axis, version, board_state_hash. Insert-only via the finalize function; members read.
- GRANTs + RLS on every new table; members read, only server-side functions write.
- Trigger on `games` recomputes `scheduled_randomization_at` from `game_date_time` minus the interval whenever kickoff changes and `board_randomized = false`.

**Finalization (server, atomic, idempotent)**
- A `SECURITY DEFINER` Postgres function `finalize_nfl_board(p_game_id)` does everything in one transaction: `SELECT ... FOR UPDATE` on the game, exit silently if `board_randomized`, verify sport = NFL and mode = randomized, expand entries into a list, shuffle the 100 positions with `gen_random_bytes`-seeded ordering, write square owners, shuffle 0–9 twice independently into `home_axis`/`away_axis`, set flags/timestamps, insert the audit row. Concurrent callers block on the row lock and the second one no-ops.
- Called from (a) a host-triggered `createServerFn` with `requireSupabaseAuth` + existing host check, and (b) the existing every-minute cron endpoint `/api/public/hooks/sync-live-scores`, which gains a pass over games whose `scheduled_randomization_at <= now()` and are not yet randomized. No browser timers are authoritative.
- RLS: existing "Members can claim available squares" policy gains `AND NOT board_locked AND assignment_mode = 'manual'`, so clients can never set positions in randomized mode; digits and lock fields are only writable by the definer function.

**Client**
- `SquaresGrid` gets a `hideOwners` prop for the pre-randomization state; layout untouched.
- Lobby/live/overlay read `assignment_mode` and branch; `useGame` already subscribes to realtime `games` + `squares`, so the reveal needs only the existing subscription plus a reveal animation keyed on `board_randomized` flipping true.
- Countdown component computes from `scheduled_randomization_at`, display-only.

**Gating**
- Every new branch is behind `sport === 'NFL' && assignment_mode === 'randomized'`; NBA and manual NFL games follow the unchanged path.

## Verification
- Entry counts preserved and positions unique (4/3/5 case); both axes contain 0–9 once and differ independently; persistence across reload; second randomize attempt is a no-op; simultaneous cron + host call finalizes once; 37-entry partial board; an NBA game behaves exactly as before.
