-- Add test_mode column to post_qa for proper cache differentiation
ALTER TABLE public.post_qa ADD COLUMN IF NOT EXISTS test_mode text;