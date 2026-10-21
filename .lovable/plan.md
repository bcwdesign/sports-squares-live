# Profile privacy: only players in the same game can see each other

## What changes
Right now any signed-in user can see every player's name and picture. After this change, a player can only see:
- their own profile
- profiles of people who share at least one game with them, whether as host or as a player

Nothing you can see in the app changes. Boards, lobbies, chat and results already show names saved on each game, and admin and host-management pages use trusted server access, so they keep working.

## Technical details
- One migration on `public.profiles`:
  - Drop the policy "Profiles viewable by authenticated users" (`USING (true)`).
  - Add a private SECURITY DEFINER helper `private.shares_game_with(_other uuid)` (stable, search_path public). It checks for any game where both `auth.uid()` and `_other` are host (`games.host_id`) or member (`game_players.user_id`). EXECUTE is granted only to `authenticated`, and the helper lives in the existing `private` schema like the other helpers.
  - New SELECT policy for `authenticated`: `id = auth.uid() OR private.shares_game_with(id)`.
- Client profile reads, checked in code: `AuthContext` and the profile page read only the user's own row. `overlay`, `hosts` and `admin` server functions use `supabaseAdmin`, which these rules don't apply to. No app code changes are needed.
- After the migration, re-run the security scan and mark `lov_db_rls_tautology_permissive_v1_77e70f908a232e7f` as fixed.
- Sign in, then check that the dashboard, a game lobby and the profile page still load with names showing.
