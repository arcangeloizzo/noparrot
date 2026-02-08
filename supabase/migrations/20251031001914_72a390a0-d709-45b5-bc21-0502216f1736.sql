-- Fix non-SECURITY DEFINER functions by adding fixed search_path
-- This prevents search path manipulation attacks

-- Fix extract_mentions function
CREATE OR REPLACE FUNCTION public.extract_mentions(content text)
RETURNS TABLE(username text)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    regexp_replace(mention[1], '@', '', 'g') AS username
  FROM regexp_matches(content, '@(\w+)', 'g') AS mention;
END;
$$;

-- Fix set_comment_level function
CREATE OR REPLACE FUNCTION public.set_comment_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
  ELSE
    SELECT COALESCE(level, 0) + 1 INTO NEW.level
    FROM public.comments
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix is_valid_username function
CREATE OR REPLACE FUNCTION public.is_valid_username(username text)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN LENGTH(username) BETWEEN 4 AND 15
    AND username ~ '^[a-zA-Z0-9_]+$'
    AND LOWER(username) NOT LIKE '%noparrot%'
    AND LOWER(username) NOT LIKE '%admin%';
END;
$$;