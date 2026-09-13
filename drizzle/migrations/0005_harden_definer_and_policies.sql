-- 1. Trigger-only SECURITY DEFINER function must not be callable via the API
REVOKE ALL ON FUNCTION public.recompute_scheduled_randomization() FROM PUBLIC, anon, authenticated;

-- 2. Scope game/quarter reads to signed-in members only (no anon role)
DROP POLICY IF EXISTS "Members can view their games" ON public.games;
CREATE POLICY "Members can view their games"
ON public.games FOR SELECT TO authenticated
USING ((host_id = auth.uid()) OR private.is_game_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view quarter results" ON public.quarter_results;
CREATE POLICY "Members can view quarter results"
ON public.quarter_results FOR SELECT TO authenticated
USING (private.is_game_member(game_id, auth.uid()));

-- 3. Controlled INSERT path for quarter results: hosts/super admins only.
DROP POLICY IF EXISTS "Hosts can insert quarter results" ON public.quarter_results;
CREATE POLICY "Hosts can insert quarter results"
ON public.quarter_results FOR INSERT TO authenticated
WITH CHECK (private.can_admin_game(game_id, auth.uid()));