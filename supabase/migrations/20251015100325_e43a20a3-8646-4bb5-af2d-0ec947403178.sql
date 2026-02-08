-- Tabelle per gestione media (immagini e video)

-- Tabella principale media
CREATE TABLE IF NOT EXISTS public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  mime TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_sec INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella ponte post-media
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  order_idx INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, media_id)
);

-- Tabella ponte commenti-media
CREATE TABLE IF NOT EXISTS public.comment_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  order_idx INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, media_id)
);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_media ENABLE ROW LEVEL SECURITY;

-- RLS policies per media
CREATE POLICY "Media viewable by everyone"
  ON public.media FOR SELECT
  USING (true);

CREATE POLICY "Users can upload own media"
  ON public.media FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own media"
  ON public.media FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS policies per post_media
CREATE POLICY "Post media viewable by everyone"
  ON public.post_media FOR SELECT
  USING (true);

CREATE POLICY "Post authors can insert media"
  ON public.post_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Post authors can delete media"
  ON public.post_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.author_id = auth.uid()
    )
  );

-- RLS policies per comment_media
CREATE POLICY "Comment media viewable by everyone"
  ON public.comment_media FOR SELECT
  USING (true);

CREATE POLICY "Comment authors can insert media"
  ON public.comment_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comments
      WHERE comments.id = comment_media.comment_id
      AND comments.author_id = auth.uid()
    )
  );

CREATE POLICY "Comment authors can delete media"
  ON public.comment_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.comments
      WHERE comments.id = comment_media.comment_id
      AND comments.author_id = auth.uid()
    )
  );

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_media_owner ON public.media(owner_id);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_media ON public.post_media(media_id);
CREATE INDEX IF NOT EXISTS idx_comment_media_comment ON public.comment_media(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_media_media ON public.comment_media(media_id);