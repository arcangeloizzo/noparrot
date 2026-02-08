-- Add is_intent column to posts table for Intent Gate feature
-- True when post contains unanalyzable URL - user text is the cognitive source

ALTER TABLE public.posts
ADD COLUMN is_intent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.posts.is_intent IS 
  'True when post contains unanalyzable URL (Instagram, Facebook, blocked sites) - user text serves as the cognitive source for comprehension gate';