
CREATE TABLE public.score_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quarter INTEGER NOT NULL,
  home TEXT NOT NULL DEFAULT '0',
  away TEXT NOT NULL DEFAULT '0',
  clock TEXT NOT NULL DEFAULT '12:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id, quarter)
);

CREATE INDEX idx_score_drafts_game_user ON public.score_drafts (game_id, user_id);

ALTER TABLE public.score_drafts ENABLE ROW LEVEL SECURITY;

-- Only the host of the game can read their own drafts
CREATE POLICY "Host can view own score drafts"
ON public.score_drafts
FOR SELECT
USING (user_id = auth.uid() AND public.is_game_host(game_id, auth.uid()));

CREATE POLICY "Host can insert own score drafts"
ON public.score_drafts
FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_game_host(game_id, auth.uid()));

CREATE POLICY "Host can update own score drafts"
ON public.score_drafts
FOR UPDATE
USING (user_id = auth.uid() AND public.is_game_host(game_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_game_host(game_id, auth.uid()));

CREATE POLICY "Host can delete own score drafts"
ON public.score_drafts
FOR DELETE
USING (user_id = auth.uid() AND public.is_game_host(game_id, auth.uid()));
