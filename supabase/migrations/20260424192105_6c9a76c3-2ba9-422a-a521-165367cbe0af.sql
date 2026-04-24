-- Add share_token to games for public overlay access
ALTER TABLE public.games
  ADD COLUMN share_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'base64');

-- Make sure each game gets a unique token
CREATE UNIQUE INDEX games_share_token_key ON public.games(share_token);

-- Public RPC: returns minimal game state for the overlay when token matches.
-- SECURITY DEFINER bypasses RLS but only returns data for the matching token.
CREATE OR REPLACE FUNCTION public.get_overlay_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      'invite_code', g.invite_code,
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
$$;

-- Allow anonymous + authenticated callers to invoke the RPC
GRANT EXECUTE ON FUNCTION public.get_overlay_by_token(text) TO anon, authenticated;