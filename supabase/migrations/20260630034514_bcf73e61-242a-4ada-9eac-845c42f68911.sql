
-- 1) Overlay: remove invite_code from the public anon-callable overlay RPC.
CREATE OR REPLACE FUNCTION public.get_overlay_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g public.games%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO g FROM public.games WHERE share_token = _token;
  IF g.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'sport', g.sport,
      'home_team', g.home_team,
      'away_team', g.away_team,
      'status', g.status,
      'home_axis', g.home_axis,
      'away_axis', g.away_axis,
      'home_score', g.home_score,
      'away_score', g.away_score,
      'quarter', g.quarter,
      'clock', g.clock,
      'host_id', g.host_id,
      'max_squares_per_user', g.max_squares_per_user,
      'entry_amount_label', NULL,
      'game_date_time', g.game_date_time,
      'created_at', g.created_at
    ),
    'squares', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'game_id', s.game_id,
        'row', s.row,
        'col', s.col,
        'owner_id', s.owner_id,
        'owner_name', s.owner_name
      )) FROM public.squares s WHERE s.game_id = g.id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

-- 2) Lock down SECURITY DEFINER function execution. Revoke broad grants and
-- re-grant only to the roles that legitimately call each function.

-- Trigger-only functions: never called from the Data API; revoke entirely.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.snapshot_quarter_result()',
    'public.add_host_as_player()',
    'public.handle_new_user()',
    'public.seed_squares()',
    'public.sync_game_players_from_profile()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- Admin-only RPCs: revoke from anon; keep authenticated (role-checked inside).
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_recent_winners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_winners() TO authenticated;

-- RLS helper functions used by policies for signed-in users: revoke from anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_game_host(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_host(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_game_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_claim_square(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_claim_square(uuid, uuid) TO authenticated;

-- Public overlay RPC stays callable by anon (needed for unauthenticated overlays).
REVOKE ALL ON FUNCTION public.get_overlay_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_overlay_by_token(text) TO anon, authenticated;

-- 3) Avatars bucket: stop allowing listing by anyone. Direct public URL
-- downloads still work because the bucket is public. Listing now requires
-- the file to belong to the calling authenticated user.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can list their own avatar files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
