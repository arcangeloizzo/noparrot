-- Create table for focus bookmarks (daily_focus and interest_focus)
CREATE TABLE public.focus_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  focus_id UUID NOT NULL,
  focus_type TEXT NOT NULL CHECK (focus_type IN ('daily', 'interest')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, focus_id, focus_type)
);

-- Enable RLS
ALTER TABLE public.focus_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own focus bookmarks"
ON public.focus_bookmarks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus bookmarks"
ON public.focus_bookmarks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus bookmarks"
ON public.focus_bookmarks
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_focus_bookmarks_user ON public.focus_bookmarks(user_id);
CREATE INDEX idx_focus_bookmarks_focus ON public.focus_bookmarks(focus_id, focus_type);