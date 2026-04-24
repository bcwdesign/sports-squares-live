-- Create public avatars bucket for player profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for the avatars bucket
-- Anyone can view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder (folder = user id)
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own avatar files
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own avatar files
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Keep game_players in sync with profile updates (display_name, avatar_url)
-- so existing lobbies / games reflect the new profile photo and name.
CREATE OR REPLACE FUNCTION public.sync_game_players_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_players
  SET display_name = NEW.display_name,
      avatar_url = NEW.avatar_url
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_game_players ON public.profiles;
CREATE TRIGGER profiles_sync_game_players
AFTER UPDATE OF display_name, avatar_url ON public.profiles
FOR EACH ROW
WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
EXECUTE FUNCTION public.sync_game_players_from_profile();

-- Allow members to UPDATE game_players rows for themselves (needed for the trigger
-- if invoked via RLS path; SECURITY DEFINER bypasses, but adding the policy is
-- still useful for direct user updates of their own seat metadata).
CREATE POLICY "Players can update their own seat"
ON public.game_players FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());