-- Add shares_count column to posts table
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- Function to increment shares count (for both reshares and DM shares)
CREATE OR REPLACE FUNCTION public.increment_post_shares(target_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts 
  SET shares_count = COALESCE(shares_count, 0) + 1 
  WHERE id = target_post_id;
END;
$$;

-- Trigger function for automatic increment on reshare
CREATE OR REPLACE FUNCTION public.increment_shares_on_reshare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quoted_post_id IS NOT NULL THEN
    UPDATE public.posts 
    SET shares_count = COALESCE(shares_count, 0) + 1 
    WHERE id = NEW.quoted_post_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for reshares
DROP TRIGGER IF EXISTS on_post_reshare_increment ON public.posts;
CREATE TRIGGER on_post_reshare_increment
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_shares_on_reshare();