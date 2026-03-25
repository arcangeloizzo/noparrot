
ALTER TABLE public.voice_posts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body_text text;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body_text text;
