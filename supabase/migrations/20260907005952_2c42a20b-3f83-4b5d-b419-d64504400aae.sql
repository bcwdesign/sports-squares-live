-- Helper functions
CREATE OR REPLACE FUNCTION public.can_host(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('host'::public.app_role, 'super_admin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_admin_game(_game_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
$$;

REVOKE EXECUTE ON FUNCTION public.can_host(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_game(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_host(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_game(uuid, uuid) TO authenticated, service_role;

-- Backfill host role for existing non-guest game owners
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT g.host_id, 'host'::public.app_role
FROM public.games g
JOIN public.profiles p ON p.id = g.host_id
WHERE p.is_guest = false
ON CONFLICT (user_id, role) DO NOTHING;

-- Audit log
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  action text NOT NULL CHECK (action IN ('assigned', 'revoked')),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_audit_log TO authenticated;
GRANT ALL ON public.role_audit_log TO service_role;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view role audit log" ON public.role_audit_log;
CREATE POLICY "Super admins can view role audit log"
ON public.role_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE INDEX IF NOT EXISTS role_audit_log_created_at_idx ON public.role_audit_log (created_at DESC);

-- Game creation now requires host permission
DROP POLICY IF EXISTS "Authenticated can create games as host" ON public.games;
CREATE POLICY "Hosts can create games"
ON public.games FOR INSERT TO authenticated
WITH CHECK (host_id = auth.uid() AND public.can_host(auth.uid()));

-- Super admin emergency access on game administration
DROP POLICY IF EXISTS "Host can update their game" ON public.games;
CREATE POLICY "Host or super admin can update game"
ON public.games FOR UPDATE TO authenticated
USING (public.can_admin_game(id, auth.uid()))
WITH CHECK (public.can_admin_game(id, auth.uid()));

DROP POLICY IF EXISTS "Host can delete their game" ON public.games;
CREATE POLICY "Host or super admin can delete game"
ON public.games FOR DELETE TO authenticated
USING (public.can_admin_game(id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage all squares" ON public.squares;
CREATE POLICY "Host or super admin can manage squares"
ON public.squares FOR ALL TO authenticated
USING (public.can_admin_game(game_id, auth.uid()))
WITH CHECK (public.can_admin_game(game_id, auth.uid()));

DROP POLICY IF EXISTS "Host can view own score drafts" ON public.score_drafts;
CREATE POLICY "Host can view own score drafts"
ON public.score_drafts FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.can_admin_game(game_id, auth.uid()));

DROP POLICY IF EXISTS "Host can insert own score drafts" ON public.score_drafts;
CREATE POLICY "Host can insert own score drafts"
ON public.score_drafts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_admin_game(game_id, auth.uid()));

DROP POLICY IF EXISTS "Host can update own score drafts" ON public.score_drafts;
CREATE POLICY "Host can update own score drafts"
ON public.score_drafts FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.can_admin_game(game_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.can_admin_game(game_id, auth.uid()));

DROP POLICY IF EXISTS "Host can delete own score drafts" ON public.score_drafts;
CREATE POLICY "Host can delete own score drafts"
ON public.score_drafts FOR DELETE TO authenticated
USING (user_id = auth.uid() AND public.can_admin_game(game_id, auth.uid()));