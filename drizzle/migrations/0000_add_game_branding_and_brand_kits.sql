-- Game-level branding snapshot (all optional; defaults keep existing games identical)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS branding_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS branding_company_name TEXT,
  ADD COLUMN IF NOT EXISTS branding_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS branding_primary TEXT,
  ADD COLUMN IF NOT EXISTS branding_secondary TEXT,
  ADD COLUMN IF NOT EXISTS branding_background TEXT,
  ADD COLUMN IF NOT EXISTS branding_claimed_color TEXT,
  ADD COLUMN IF NOT EXISTS branding_winning_color TEXT,
  ADD COLUMN IF NOT EXISTS branding_square_style TEXT NOT NULL DEFAULT 'tinted';

-- Reusable brand kits owned by a host
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#3B82F6',
  secondary_color TEXT NOT NULL DEFAULT '#22C55E',
  background_color TEXT NOT NULL DEFAULT '#111318',
  claimed_square_color TEXT,
  winning_square_color TEXT,
  square_style TEXT NOT NULL DEFAULT 'tinted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_owner_name_key ON public.brand_kits (owner_user_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their brand kits"
  ON public.brand_kits FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can create brand kits"
  ON public.brand_kits FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update their brand kits"
  ON public.brand_kits FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete their brand kits"
  ON public.brand_kits FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());