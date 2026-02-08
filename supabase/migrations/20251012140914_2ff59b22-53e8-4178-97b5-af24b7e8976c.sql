-- 1. Aggiungi colonne a profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Aggiungi constraint età minima (>=13 anni)
ALTER TABLE public.profiles
  ADD CONSTRAINT check_min_age 
  CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE - INTERVAL '13 years');

-- 3. Rendi username UNIQUE (se non lo è già)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;

-- 4. Storage bucket per avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880, -- 5MB max
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policies per storage avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 6. Tabella followers
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- 7. RLS per followers
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Followers viewable by everyone" ON public.followers;
CREATE POLICY "Followers viewable by everyone"
  ON public.followers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.followers;
CREATE POLICY "Users can follow others"
  ON public.followers FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.followers;
CREATE POLICY "Users can unfollow"
  ON public.followers FOR DELETE
  USING (auth.uid() = follower_id);

-- 8. Indici per performance followers
CREATE INDEX IF NOT EXISTS followers_follower_id_idx ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS followers_following_id_idx ON public.followers(following_id);

-- 9. Funzione validazione username
CREATE OR REPLACE FUNCTION public.is_valid_username(username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN LENGTH(username) BETWEEN 4 AND 15
    AND username ~ '^[a-zA-Z0-9_]+$'
    AND LOWER(username) NOT LIKE '%noparrot%'
    AND LOWER(username) NOT LIKE '%admin%';
END;
$$;

-- 10. Aggiorna trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, date_of_birth)
  VALUES (
    new.id,
    new.email, -- Username temporaneo, verrà aggiornato nello step 3
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    NULL, -- Nessun avatar di default
    (new.raw_user_meta_data->>'date_of_birth')::DATE
  );
  
  RETURN new;
END;
$$;