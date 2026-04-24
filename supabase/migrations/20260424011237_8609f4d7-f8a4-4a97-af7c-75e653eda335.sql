-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'guest'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((NEW.raw_user_meta_data->>'is_guest')::boolean, NEW.email IS NULL)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Games table
CREATE TYPE public.game_status AS ENUM ('lobby', 'locked', 'live', 'completed');

CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date_time TIMESTAMPTZ,
  status public.game_status NOT NULL DEFAULT 'lobby',
  invite_code TEXT NOT NULL UNIQUE,
  max_squares_per_user INT NOT NULL DEFAULT 10,
  entry_amount_label TEXT,
  home_axis INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6,7,8,9],
  away_axis INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6,7,8,9],
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  quarter INT NOT NULL DEFAULT 1,
  clock TEXT NOT NULL DEFAULT '12:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Game players
CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_game_member(_game_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players WHERE game_id = _game_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_game_host(_game_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id AND host_id = _user_id);
$$;

-- Games policies
CREATE POLICY "Members can view their games"
  ON public.games FOR SELECT
  USING (host_id = auth.uid() OR public.is_game_member(id, auth.uid()));
CREATE POLICY "Anyone signed in can lookup by invite code"
  ON public.games FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create games as host"
  ON public.games FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host can update their game"
  ON public.games FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Host can delete their game"
  ON public.games FOR DELETE USING (host_id = auth.uid());

-- Game players policies
CREATE POLICY "Members can view game players"
  ON public.game_players FOR SELECT
  USING (public.is_game_member(game_id, auth.uid()));
CREATE POLICY "Authenticated can join games"
  ON public.game_players FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Players can leave their seat"
  ON public.game_players FOR DELETE USING (user_id = auth.uid());

-- Squares
CREATE TABLE public.squares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  row INT NOT NULL CHECK (row BETWEEN 0 AND 9),
  col INT NOT NULL CHECK (col BETWEEN 0 AND 9),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, row, col)
);
ALTER TABLE public.squares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view squares"
  ON public.squares FOR SELECT
  USING (public.is_game_member(game_id, auth.uid()));

-- Players can claim an available square if game is in lobby and they haven't hit their cap
CREATE OR REPLACE FUNCTION public.can_claim_square(_game_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  game_status_val public.game_status;
  cap INT;
  current_count INT;
BEGIN
  SELECT status, max_squares_per_user INTO game_status_val, cap
  FROM public.games WHERE id = _game_id;
  IF game_status_val IS NULL OR game_status_val <> 'lobby' THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO current_count
  FROM public.squares WHERE game_id = _game_id AND owner_id = _user_id;
  RETURN current_count < cap;
END;
$$;

CREATE POLICY "Members can claim available squares"
  ON public.squares FOR UPDATE
  USING (
    public.is_game_member(game_id, auth.uid())
    AND owner_id IS NULL
    AND public.can_claim_square(game_id, auth.uid())
  )
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Host can manage all squares"
  ON public.squares FOR ALL
  USING (public.is_game_host(game_id, auth.uid()))
  WITH CHECK (public.is_game_host(game_id, auth.uid()));

-- Auto-create 100 squares when a game is created
CREATE OR REPLACE FUNCTION public.seed_squares()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.squares (game_id, row, col)
  SELECT NEW.id, r, c
  FROM generate_series(0, 9) r, generate_series(0, 9) c;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_squares_on_game_create
  AFTER INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.seed_squares();

-- Auto-add host as a player
CREATE OR REPLACE FUNCTION public.add_host_as_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_name TEXT;
  host_avatar TEXT;
BEGIN
  SELECT display_name, avatar_url INTO host_name, host_avatar
  FROM public.profiles WHERE id = NEW.host_id;
  INSERT INTO public.game_players (game_id, user_id, display_name, avatar_url)
  VALUES (NEW.id, NEW.host_id, COALESCE(host_name, 'Host'), host_avatar);
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_host_player_on_game_create
  AFTER INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.add_host_as_player();

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view messages"
  ON public.messages FOR SELECT USING (public.is_game_member(game_id, auth.uid()));
CREATE POLICY "Members can post messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_game_member(game_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.squares REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Helpful indexes
CREATE INDEX idx_games_invite_code ON public.games(invite_code);
CREATE INDEX idx_games_host_id ON public.games(host_id);
CREATE INDEX idx_squares_game_id ON public.squares(game_id);
CREATE INDEX idx_game_players_game_id ON public.game_players(game_id);
CREATE INDEX idx_game_players_user_id ON public.game_players(user_id);
CREATE INDEX idx_messages_game_id_created_at ON public.messages(game_id, created_at);