-- Ensure share counter updates work even with RLS
-- Recreate increment_post_shares to explicitly bypass row security
CREATE OR REPLACE FUNCTION public.increment_post_shares(target_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Explicitly disable RLS inside this function (requires function owner privileges)
  PERFORM set_config('row_security', 'off', true);

  UPDATE public.posts
  SET shares_count = COALESCE(shares_count, 0) + 1
  WHERE id = target_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_post_shares(uuid) TO PUBLIC;