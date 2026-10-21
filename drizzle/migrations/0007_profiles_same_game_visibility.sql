CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.shares_game_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT id AS game_id FROM public.games WHERE host_id = auth.uid()
    UNION SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
  ), theirs AS (
    SELECT id AS game_id FROM public.games WHERE host_id = _other
    UNION SELECT game_id FROM public.game_players WHERE user_id = _other
  )
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM mine JOIN theirs USING (game_id));
$$;
REVOKE ALL ON FUNCTION private.shares_game_with(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_game_with(uuid) TO authenticated;
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by self or co-players" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.shares_game_with(id));