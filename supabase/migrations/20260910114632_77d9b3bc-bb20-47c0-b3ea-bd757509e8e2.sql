
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.can_host(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('host'::public.app_role, 'super_admin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_game_host(_game_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.can_admin_game(_game_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id)
      OR private.has_role(_user_id, 'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION private.is_game_member(_game_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_players WHERE game_id = _game_id AND user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.can_claim_square(_game_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  game_status_val public.game_status;
  cap INT;
  current_count INT;
BEGIN
  SELECT status, max_squares_per_user INTO game_status_val, cap
  FROM public.games WHERE id = _game_id;
  IF game_status_val IS NULL OR game_status_val <> 'lobby' THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO current_count
  FROM public.squares WHERE game_id = _game_id AND owner_id = _user_id;
  RETURN current_count < cap;
END;
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_host(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_game_host(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_admin_game(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_game_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_claim_square(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_host(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_game_host(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_admin_game(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_game_member(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_claim_square(uuid, uuid) TO authenticated, anon, service_role;

-- game_players
DROP POLICY "Members can view game players" ON public.game_players;
CREATE POLICY "Members can view game players" ON public.game_players FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- games
DROP POLICY "Anyone signed in can lookup by invite code" ON public.games;
DROP POLICY "Host or super admin can delete game" ON public.games;
DROP POLICY "Host or super admin can update game" ON public.games;
DROP POLICY "Hosts can create games" ON public.games;
DROP POLICY "Members can view their games" ON public.games;
CREATE POLICY "Host or super admin can delete game" ON public.games FOR DELETE TO authenticated
  USING (private.can_admin_game(id, auth.uid()));
CREATE POLICY "Host or super admin can update game" ON public.games FOR UPDATE TO authenticated
  USING (private.can_admin_game(id, auth.uid())) WITH CHECK (private.can_admin_game(id, auth.uid()));
CREATE POLICY "Hosts can create games" ON public.games FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid() AND private.can_host(auth.uid()));
CREATE POLICY "Members can view their games" ON public.games FOR SELECT
  USING (host_id = auth.uid() OR private.is_game_member(id, auth.uid()));

-- messages
DROP POLICY "Members can post messages" ON public.messages;
DROP POLICY "Members can view messages" ON public.messages;
CREATE POLICY "Members can post messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_game_member(game_id, auth.uid()));
CREATE POLICY "Members can view messages" ON public.messages FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- quarter_results
DROP POLICY "Members can view quarter results" ON public.quarter_results;
CREATE POLICY "Members can view quarter results" ON public.quarter_results FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- role_audit_log
DROP POLICY "Super admins can view role audit log" ON public.role_audit_log;
CREATE POLICY "Super admins can view role audit log" ON public.role_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

-- score_drafts
DROP POLICY "Host can delete own score drafts" ON public.score_drafts;
DROP POLICY "Host can insert own score drafts" ON public.score_drafts;
DROP POLICY "Host can update own score drafts" ON public.score_drafts;
DROP POLICY "Host can view own score drafts" ON public.score_drafts;
CREATE POLICY "Host can delete own score drafts" ON public.score_drafts FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND private.can_admin_game(game_id, auth.uid()));
CREATE POLICY "Host can insert own score drafts" ON public.score_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.can_admin_game(game_id, auth.uid()));
CREATE POLICY "Host can update own score drafts" ON public.score_drafts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND private.can_admin_game(game_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND private.can_admin_game(game_id, auth.uid()));
CREATE POLICY "Host can view own score drafts" ON public.score_drafts FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND private.can_admin_game(game_id, auth.uid()));

-- score_events
DROP POLICY "Host can insert score events" ON public.score_events;
DROP POLICY "Members can view score events" ON public.score_events;
CREATE POLICY "Host can insert score events" ON public.score_events FOR INSERT TO authenticated
  WITH CHECK (private.is_game_host(game_id, auth.uid()));
CREATE POLICY "Members can view score events" ON public.score_events FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- squares
DROP POLICY "Host or super admin can manage squares" ON public.squares;
DROP POLICY "Members can claim available squares" ON public.squares;
DROP POLICY "Members can view squares" ON public.squares;
CREATE POLICY "Host or super admin can manage squares" ON public.squares FOR ALL TO authenticated
  USING (private.can_admin_game(game_id, auth.uid())) WITH CHECK (private.can_admin_game(game_id, auth.uid()));
CREATE POLICY "Members can claim available squares" ON public.squares FOR UPDATE
  USING (private.is_game_member(game_id, auth.uid()) AND owner_id IS NULL AND private.can_claim_square(game_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members can view squares" ON public.squares FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- user_roles
DROP POLICY "Super admins can delete roles" ON public.user_roles;
DROP POLICY "Super admins can insert roles" ON public.user_roles;
DROP POLICY "Super admins can view all roles" ON public.user_roles;
CREATE POLICY "Super admins can delete roles" ON public.user_roles FOR DELETE
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can insert roles" ON public.user_roles FOR INSERT
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP FUNCTION IF EXISTS public.admin_stats();
DROP FUNCTION IF EXISTS public.admin_recent_winners();
DROP FUNCTION IF EXISTS public.get_overlay_by_token(text);
DROP FUNCTION IF EXISTS public.can_claim_square(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_admin_game(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_host(uuid);
DROP FUNCTION IF EXISTS public.is_game_host(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_game_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
