
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS prize_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prize_type text,
  ADD COLUMN IF NOT EXISTS prize_description text,
  ADD COLUMN IF NOT EXISTS prize_timing text,
  ADD COLUMN IF NOT EXISTS requires_age_verification boolean NOT NULL DEFAULT false;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_prize_type_check,
  ADD CONSTRAINT games_prize_type_check
    CHECK (prize_type IS NULL OR prize_type IN ('food','alcohol','money','gift'));

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_prize_timing_check,
  ADD CONSTRAINT games_prize_timing_check
    CHECK (prize_timing IS NULL OR prize_timing IN ('q1','q2','q3','final','every_quarter'));

ALTER TABLE public.quarter_results
  ADD COLUMN IF NOT EXISTS prize_claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamp with time zone;
