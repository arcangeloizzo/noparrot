-- Create focus_comment_reactions table
CREATE TABLE public.focus_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  focus_comment_id UUID NOT NULL REFERENCES public.focus_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(focus_comment_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE public.focus_comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Focus comment reactions viewable by everyone"
  ON public.focus_comment_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own focus comment reactions"
  ON public.focus_comment_reactions FOR ALL
  USING (auth.uid() = user_id);