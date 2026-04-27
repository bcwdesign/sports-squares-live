-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helper to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies on user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. Aggregated stats function — super admin only
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_guests', (SELECT COUNT(*) FROM public.profiles WHERE is_guest = true),
    'total_games', (SELECT COUNT(*) FROM public.games),
    'active_games', (SELECT COUNT(*) FROM public.games WHERE status IN ('lobby','locked','live')),
    'live_games', (SELECT COUNT(*) FROM public.games WHERE status = 'live'),
    'lobby_games', (SELECT COUNT(*) FROM public.games WHERE status = 'lobby'),
    'completed_games', (SELECT COUNT(*) FROM public.games WHERE status = 'completed'),
    'total_players', (SELECT COUNT(*) FROM public.game_players),
    'total_squares_claimed', (SELECT COUNT(*) FROM public.squares WHERE owner_id IS NOT NULL),
    'total_messages', (SELECT COUNT(*) FROM public.messages),
    'total_venues', (SELECT COUNT(*) FROM public.venues),
    'auto_synced_games', (SELECT COUNT(*) FROM public.games WHERE auto_sync_enabled = true),
    'games_last_7d', (SELECT COUNT(*) FROM public.games WHERE created_at > now() - interval '7 days'),
    'users_last_7d', (SELECT COUNT(*) FROM public.profiles WHERE created_at > now() - interval '7 days')
  ) INTO result;

  RETURN result;
END;
$$;

-- 6. Recent winners function — super admin only
CREATE OR REPLACE FUNCTION public.admin_recent_winners()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO result
  FROM (
    SELECT
      g.id AS game_id,
      g.name AS game_name,
      g.home_team,
      g.away_team,
      g.home_score,
      g.away_score,
      g.created_at,
      (
        SELECT s.owner_name FROM public.squares s
        WHERE s.game_id = g.id
          AND s.row = array_position(g.away_axis, (g.away_score % 10)) - 1
          AND s.col = array_position(g.home_axis, (g.home_score % 10)) - 1
        LIMIT 1
      ) AS winner_name
    FROM public.games g
    WHERE g.status = 'completed'
    ORDER BY g.created_at DESC
    LIMIT 25
  ) r;

  RETURN result;
END;
$$;

-- 7. Seed super_admin role for joe@techlevitate.com (if exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'joe@techlevitate.com'
ON CONFLICT (user_id, role) DO NOTHING;