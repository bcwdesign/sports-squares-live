-- NFL pre-game randomization: assignment mode, entries, audit, atomic finalize.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS randomization_minutes_before_kickoff integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS scheduled_randomization_at timestamptz,
  ADD COLUMN IF NOT EXISTS board_randomized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS board_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS randomized_at timestamptz,
  ADD COLUMN IF NOT EXISTS randomized_by uuid,
  ADD COLUMN IF NOT EXISTS randomization_version integer NOT NULL DEFAULT 1;

-- Reserved entries (randomized mode only): how many squares a player owns
-- before physical positions exist.
CREATE TABLE IF NOT EXISTS public.game_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  entry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_entries TO authenticated;
GRANT ALL ON public.game_entries TO service_role;
ALTER TABLE public.game_entries ENABLE ROW LEVEL SECURITY;

-- Permanent audit record of a finalized board.
CREATE TABLE IF NOT EXISTS public.board_randomizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  external_game_id text,
  kickoff_at timestamptz,
  scheduled_randomization_at timestamptz,
  randomized_at timestamptz NOT NULL DEFAULT now(),
  randomized_by uuid,
  trigger_source text NOT NULL DEFAULT 'manual',
  player_count integer NOT NULL DEFAULT 0,
  claimed_count integer NOT NULL DEFAULT 0,
  home_axis integer[] NOT NULL,
  away_axis integer[] NOT NULL,
  randomization_version integer NOT NULL DEFAULT 1,
  board_state_hash text,
  UNIQUE (game_id, randomization_version)
);

GRANT SELECT ON public.board_randomizations TO authenticated;
GRANT ALL ON public.board_randomizations TO service_role;
ALTER TABLE public.board_randomizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view board randomizations"
  ON public.board_randomizations FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

-- Can this user reserve `n` entries right now?
CREATE OR REPLACE FUNCTION private.can_reserve_entries(_game_id uuid, _user_id uuid, _count integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  g public.games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = _game_id;
  IF g.id IS NULL THEN RETURN false; END IF;
  IF g.assignment_mode <> 'randomized' OR g.board_locked OR g.board_randomized THEN RETURN false; END IF;
  IF g.status <> 'lobby' THEN RETURN false; END IF;
  IF NOT private.is_game_member(_game_id, _user_id) THEN RETURN false; END IF;
  RETURN _count >= 0 AND _count <= g.max_squares_per_user;
END;
$$;

CREATE POLICY "Members can view game entries"
  ON public.game_entries FOR SELECT
  USING (private.is_game_member(game_id, auth.uid()));

CREATE POLICY "Members can reserve their own entries"
  ON public.game_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.can_reserve_entries(game_id, auth.uid(), entry_count));

CREATE POLICY "Members can update their own entries"
  ON public.game_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND private.can_reserve_entries(game_id, auth.uid(), 0))
  WITH CHECK (user_id = auth.uid() AND private.can_reserve_entries(game_id, auth.uid(), entry_count));

CREATE POLICY "Members can drop their own entries"
  ON public.game_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND private.can_reserve_entries(game_id, auth.uid(), 0));

-- Manual claiming is blocked entirely in randomized mode / after lock.
CREATE OR REPLACE FUNCTION private.can_claim_square(_game_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  game_status_val public.game_status;
  cap INT;
  current_count INT;
  mode TEXT;
  locked BOOLEAN;
BEGIN
  SELECT status, max_squares_per_user, assignment_mode, board_locked
    INTO game_status_val, cap, mode, locked
  FROM public.games WHERE id = _game_id;
  IF game_status_val IS NULL OR game_status_val <> 'lobby' THEN
    RETURN false;
  END IF;
  IF COALESCE(mode, 'manual') <> 'manual' OR COALESCE(locked, false) THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO current_count
  FROM public.squares WHERE game_id = _game_id AND owner_id = _user_id;
  RETURN current_count < cap;
END;
$$;

-- Keep scheduled_randomization_at in sync with kickoff, until the board locks.
CREATE OR REPLACE FUNCTION public.recompute_scheduled_randomization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.board_randomized THEN
    RETURN NEW;
  END IF;
  IF NEW.assignment_mode = 'randomized' AND NEW.game_date_time IS NOT NULL THEN
    NEW.scheduled_randomization_at :=
      NEW.game_date_time - make_interval(mins => COALESCE(NEW.randomization_minutes_before_kickoff, 10));
  ELSE
    NEW.scheduled_randomization_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_recompute_scheduled_randomization ON public.games;
CREATE TRIGGER games_recompute_scheduled_randomization
  BEFORE INSERT OR UPDATE OF game_date_time, assignment_mode, randomization_minutes_before_kickoff
  ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.recompute_scheduled_randomization();

-- Atomic, idempotent board finalization. Service role only.
CREATE OR REPLACE FUNCTION public.finalize_nfl_board(
  p_game_id uuid,
  p_actor uuid DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  g public.games%ROWTYPE;
  new_home integer[];
  new_away integer[];
  n_entries integer;
  n_players integer;
  rec record;
  audit_id uuid;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF g.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF g.board_randomized OR g.board_locked THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_randomized', 'game_id', g.id);
  END IF;
  IF upper(COALESCE(g.sport, '')) <> 'NFL' OR g.assignment_mode <> 'randomized' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  -- Clear any stray owners, then assign shuffled positions from the entry list.
  UPDATE public.squares SET owner_id = NULL, owner_name = NULL WHERE game_id = g.id;

  WITH expanded AS (
    SELECT e.user_id, e.display_name,
           row_number() OVER (ORDER BY md5(gen_random_bytes(16)::text)) AS rn
    FROM public.game_entries e, generate_series(1, e.entry_count)
    WHERE e.game_id = g.id AND e.entry_count > 0
  ), positions AS (
    SELECT s.id, row_number() OVER (ORDER BY md5(gen_random_bytes(16)::text)) AS rn
    FROM public.squares s WHERE s.game_id = g.id
  )
  UPDATE public.squares s
     SET owner_id = x.user_id, owner_name = x.display_name
    FROM expanded x JOIN positions p ON p.rn = x.rn
   WHERE s.id = p.id;

  SELECT count(*) INTO n_entries FROM public.squares WHERE game_id = g.id AND owner_id IS NOT NULL;
  SELECT count(DISTINCT owner_id) INTO n_players FROM public.squares WHERE game_id = g.id AND owner_id IS NOT NULL;

  SELECT array_agg(d ORDER BY md5(gen_random_bytes(16)::text)) INTO new_home FROM generate_series(0, 9) d;
  SELECT array_agg(d ORDER BY md5(gen_random_bytes(16)::text)) INTO new_away FROM generate_series(0, 9) d;

  UPDATE public.games
     SET home_axis = new_home,
         away_axis = new_away,
         board_randomized = true,
         board_locked = true,
         randomized_at = now(),
         randomized_by = p_actor
   WHERE id = g.id;

  INSERT INTO public.board_randomizations (
    game_id, external_game_id, kickoff_at, scheduled_randomization_at,
    randomized_by, trigger_source, player_count, claimed_count,
    home_axis, away_axis, randomization_version, board_state_hash
  ) VALUES (
    g.id, g.external_game_id, g.game_date_time, g.scheduled_randomization_at,
    p_actor, COALESCE(p_source, 'manual'), n_players, n_entries,
    new_home, new_away, g.randomization_version,
    encode(digest(g.id::text || now()::text || new_home::text || new_away::text || n_entries::text, 'sha256'), 'hex')
  )
  RETURNING id INTO audit_id;

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'randomized', 'game_id', g.id,
    'audit_id', audit_id, 'claimed_count', n_entries, 'player_count', n_players,
    'home_axis', new_home, 'away_axis', new_away
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_nfl_board(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_nfl_board(uuid, uuid, text) TO service_role;

-- High-friction reset: clears a randomized board before kickoff. Service role only.
CREATE OR REPLACE FUNCTION public.reset_nfl_board(p_game_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  g public.games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF g.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT g.board_randomized THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_randomized'); END IF;
  IF g.status <> 'lobby' THEN RETURN jsonb_build_object('ok', false, 'reason', 'game_started'); END IF;

  UPDATE public.squares SET owner_id = NULL, owner_name = NULL WHERE game_id = g.id;
  UPDATE public.games
     SET board_randomized = false,
         board_locked = false,
         randomized_at = NULL,
         randomized_by = NULL,
         randomization_version = g.randomization_version + 1,
         home_axis = ARRAY[0,1,2,3,4,5,6,7,8,9],
         away_axis = ARRAY[0,1,2,3,4,5,6,7,8,9]
   WHERE id = g.id;

  RETURN jsonb_build_object('ok', true, 'reason', 'reset', 'game_id', g.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_nfl_board(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_nfl_board(uuid, uuid) TO service_role;