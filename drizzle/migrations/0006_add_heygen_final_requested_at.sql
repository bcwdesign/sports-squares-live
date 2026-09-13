ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS heygen_final_requested_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS games_final_recap_pending_idx
  ON public.games (status, heygen_final_requested_at)
  WHERE commentator_enabled AND heygen_reactions_enabled;