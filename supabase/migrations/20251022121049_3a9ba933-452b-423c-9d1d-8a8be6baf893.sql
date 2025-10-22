-- 1. Aggiungi campi per commenti nested
ALTER TABLE public.comments
ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
ADD COLUMN level INTEGER NOT NULL DEFAULT 0;

-- 2. Crea tabella per like ai commenti
CREATE TABLE public.comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for comment_reactions
CREATE POLICY "Comment reactions viewable by everyone"
ON public.comment_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can manage own comment reactions"
ON public.comment_reactions FOR ALL
USING (auth.uid() = user_id);

-- 3. Crea tabella per like ai media
CREATE TABLE public.media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(media_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE public.media_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for media_reactions
CREATE POLICY "Media reactions viewable by everyone"
ON public.media_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can manage own media reactions"
ON public.media_reactions FOR ALL
USING (auth.uid() = user_id);

-- 4. Crea tabella per commenti ai media
CREATE TABLE public.media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.media_comments(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_comments ENABLE ROW LEVEL SECURITY;

-- Policies for media_comments
CREATE POLICY "Media comments viewable by everyone"
ON public.media_comments FOR SELECT
USING (true);

CREATE POLICY "Users can insert own media comments"
ON public.media_comments FOR INSERT
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own media comments"
ON public.media_comments FOR UPDATE
USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own media comments"
ON public.media_comments FOR DELETE
USING (auth.uid() = author_id);

-- 5. Crea tabella per like ai commenti media
CREATE TABLE public.media_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_comment_id UUID NOT NULL REFERENCES public.media_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(media_comment_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE public.media_comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for media_comment_reactions
CREATE POLICY "Media comment reactions viewable by everyone"
ON public.media_comment_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can manage own media comment reactions"
ON public.media_comment_reactions FOR ALL
USING (auth.uid() = user_id);