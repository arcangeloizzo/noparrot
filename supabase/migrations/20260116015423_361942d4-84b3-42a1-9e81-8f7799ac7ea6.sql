-- TRANCHE A: RPC get_share_counts + 3 indexes

-- 1. RPC for aggregated share counts
CREATE OR REPLACE FUNCTION public.get_share_counts(shared_urls text[])
RETURNS TABLE(shared_url text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.shared_url, COUNT(*)::bigint
  FROM public.posts p
  WHERE p.shared_url = ANY(shared_urls)
  GROUP BY p.shared_url;
$$;

-- 2. Index for posts.shared_url (used by RPC)
CREATE INDEX IF NOT EXISTS idx_posts_shared_url 
ON public.posts (shared_url) WHERE shared_url IS NOT NULL;

-- 3. Index for focus_comments listing
CREATE INDEX IF NOT EXISTS idx_focus_comments_focus_listing 
ON public.focus_comments (focus_id, focus_type, created_at ASC);

-- 4. Index for focus_comments parent lookup (replies)
CREATE INDEX IF NOT EXISTS idx_focus_comments_parent 
ON public.focus_comments (parent_id, created_at ASC);