
ALTER TABLE public.quarter_results
  ADD COLUMN IF NOT EXISTS age_verification_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verification_provider text,
  ADD COLUMN IF NOT EXISTS age_verification_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS age_verification_submission_id text,
  ADD COLUMN IF NOT EXISTS prize_claim_status text NOT NULL DEFAULT 'not_required';

CREATE INDEX IF NOT EXISTS idx_quarter_results_submission_id
  ON public.quarter_results (age_verification_submission_id)
  WHERE age_verification_submission_id IS NOT NULL;

-- Allow winners to update their own verification status via server functions (service role bypasses anyway, but keep RLS sane).
DROP POLICY IF EXISTS "Winners can update their verification" ON public.quarter_results;
CREATE POLICY "Winners can update their verification"
  ON public.quarter_results
  FOR UPDATE
  TO authenticated
  USING (winner_user_id = auth.uid())
  WITH CHECK (winner_user_id = auth.uid());
