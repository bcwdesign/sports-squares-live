
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS commentator_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commentator_name text,
  ADD COLUMN IF NOT EXISTS commentator_personality text,
  ADD COLUMN IF NOT EXISTS commentator_voice_style text,
  ADD COLUMN IF NOT EXISTS commentator_catchphrases text,
  ADD COLUMN IF NOT EXISTS commentator_intro_script text,
  ADD COLUMN IF NOT EXISTS commentator_latest_text text,
  ADD COLUMN IF NOT EXISTS commentator_latest_audio_url text,
  ADD COLUMN IF NOT EXISTS commentator_last_spoken_at timestamptz,
  ADD COLUMN IF NOT EXISTS commentator_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS heygen_intro_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS heygen_reactions_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS heygen_avatar_id text,
  ADD COLUMN IF NOT EXISTS heygen_voice_id text,
  ADD COLUMN IF NOT EXISTS heygen_video_id text,
  ADD COLUMN IF NOT EXISTS heygen_video_status text,
  ADD COLUMN IF NOT EXISTS heygen_video_url text;
