-- Fix extract_mentions function to handle array correctly
CREATE OR REPLACE FUNCTION public.extract_mentions(content text)
RETURNS TABLE(username text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    regexp_replace(mention[1], '@', '', 'g') AS username
  FROM regexp_matches(content, '@(\w+)', 'g') AS mention;
END;
$$;