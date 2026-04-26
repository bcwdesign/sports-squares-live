-- =====================================================================
-- Live scoring (BALLDONTLIE) + venues scaffolding
-- =====================================================================

-- 1. Add external scoring columns to games
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS external_provider text,
  ADD COLUMN IF NOT EXISTS external_game_id text,
  ADD COLUMN IF NOT EXISTS external_home_team_id text,
  ADD COLUMN IF NOT EXISTS external_away_team_id text,
  ADD COLUMN IF NOT EXISTS external_home_team_name text,
  ADD COLUMN IF NOT EXISTS external_away_team_name text,
  ADD COLUMN IF NOT EXISTS period integer,
  ADD COLUMN IF NOT EXISTS game_clock text,
  ADD COLUMN IF NOT EXISTS game_status text,
  ADD COLUMN IF NOT EXISTS score_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_score_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_score_sync_error text;

-- Helpful index for sync lookups
CREATE INDEX IF NOT EXISTS idx_games_external_provider_game
  ON public.games (external_provider, external_game_id)
  WHERE external_provider IS NOT NULL;

-- 2. score_events table — append-only audit log of every score sync
CREATE TABLE IF NOT EXISTS public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_game_id text,
  home_score integer,
  away_score integer,
  period integer,
  game_clock text,
  game_status text,
  score_source text NOT NULL DEFAULT 'api',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_events_game_created
  ON public.score_events (game_id, created_at DESC);

ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

-- Game members (and the host, via is_game_member) can read events
DROP POLICY IF EXISTS "Members can view score events" ON public.score_events;
CREATE POLICY "Members can view score events"
  ON public.score_events
  FOR SELECT
  USING (public.is_game_member(game_id, auth.uid()));

-- Only the host can insert score events from a client; the service role bypasses RLS
DROP POLICY IF EXISTS "Host can insert score events" ON public.score_events;
CREATE POLICY "Host can insert score events"
  ON public.score_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_game_host(game_id, auth.uid()));

-- 3. venues — Founders Edge / Standard plan scaffolding (no payments yet)
-- NOTE: "Founders Edge" is a grandfathered plan for the first 10 bars/venues.
-- Pricing fields stored only — billing integration is intentionally deferred.
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_name text NOT NULL,
  plan_name text NOT NULL DEFAULT 'founders_edge',
  monthly_price integer NOT NULL DEFAULT 100,
  founder_edge boolean NOT NULL DEFAULT true,
  founder_edge_position integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_owner ON public.venues (owner_user_id);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their venues" ON public.venues;
CREATE POLICY "Owners can view their venues"
  ON public.venues
  FOR SELECT
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can create their venues" ON public.venues;
CREATE POLICY "Owners can create their venues"
  ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their venues" ON public.venues;
CREATE POLICY "Owners can update their venues"
  ON public.venues
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their venues" ON public.venues;
CREATE POLICY "Owners can delete their venues"
  ON public.venues
  FOR DELETE
  USING (owner_user_id = auth.uid());

-- 4. Realtime: ensure score_events is broadcast (games already is via existing setup)
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_events;