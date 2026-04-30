-- Quarter winners snapshot table.
-- Populated automatically when games.quarter advances or status -> completed.
CREATE TABLE IF NOT EXISTS public.quarter_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  home_digit INTEGER NOT NULL,
  away_digit INTEGER NOT NULL,
  winner_user_id UUID,
  winner_name TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, quarter)
);

CREATE INDEX IF NOT EXISTS quarter_results_game_idx ON public.quarter_results(game_id);

ALTER TABLE public.quarter_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view quarter results" ON public.quarter_results;
CREATE POLICY "Members can view quarter results"
  ON public.quarter_results FOR SELECT
  USING (public.is_game_member(game_id, auth.uid()));

-- Trigger: snapshot the just-ended quarter's winning square.
CREATE OR REPLACE FUNCTION public.snapshot_quarter_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap_quarter INTEGER;
  snap_home INTEGER;
  snap_away INTEGER;
  home_d INTEGER;
  away_d INTEGER;
  win_col INTEGER;
  win_row INTEGER;
  win_owner UUID;
  win_name TEXT;
  is_final_q BOOLEAN := false;
BEGIN
  -- Decide if and which quarter to snapshot.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND COALESCE(OLD.status::text, '') <> 'completed' THEN
      snap_quarter := NEW.quarter;
      snap_home := NEW.home_score;
      snap_away := NEW.away_score;
      is_final_q := true;
    ELSIF NEW.quarter > OLD.quarter THEN
      -- Quarter advanced: snapshot the score at the moment of the OLD quarter.
      snap_quarter := OLD.quarter;
      snap_home := OLD.home_score;
      snap_away := OLD.away_score;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Resolve the winning square via the axes.
  home_d := snap_home % 10;
  away_d := snap_away % 10;
  win_col := array_position(NEW.home_axis, home_d);
  win_row := array_position(NEW.away_axis, away_d);

  IF win_col IS NOT NULL AND win_row IS NOT NULL THEN
    SELECT s.owner_id, s.owner_name
      INTO win_owner, win_name
      FROM public.squares s
     WHERE s.game_id = NEW.id
       AND s.row = win_row - 1
       AND s.col = win_col - 1
     LIMIT 1;
  END IF;

  INSERT INTO public.quarter_results (
    game_id, quarter, home_score, away_score, home_digit, away_digit,
    winner_user_id, winner_name, is_final
  ) VALUES (
    NEW.id, snap_quarter, snap_home, snap_away, home_d, away_d,
    win_owner, win_name, is_final_q
  )
  ON CONFLICT (game_id, quarter) DO UPDATE
    SET home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        home_digit = EXCLUDED.home_digit,
        away_digit = EXCLUDED.away_digit,
        winner_user_id = EXCLUDED.winner_user_id,
        winner_name = EXCLUDED.winner_name,
        is_final = quarter_results.is_final OR EXCLUDED.is_final;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_snapshot_quarter ON public.games;
CREATE TRIGGER games_snapshot_quarter
  AFTER UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_quarter_result();

-- Backfill: for any already-completed games, write at least the final
-- quarter snapshot so recaps work for historical games.
INSERT INTO public.quarter_results (
  game_id, quarter, home_score, away_score, home_digit, away_digit,
  winner_user_id, winner_name, is_final
)
SELECT
  g.id,
  g.quarter,
  g.home_score,
  g.away_score,
  g.home_score % 10,
  g.away_score % 10,
  s.owner_id,
  s.owner_name,
  true
FROM public.games g
LEFT JOIN public.squares s
  ON s.game_id = g.id
 AND s.row = array_position(g.away_axis, g.away_score % 10) - 1
 AND s.col = array_position(g.home_axis, g.home_score % 10) - 1
WHERE g.status = 'completed'
ON CONFLICT (game_id, quarter) DO NOTHING;