-- Convert sources column from text[] to jsonb
ALTER TABLE public.posts 
ALTER COLUMN sources TYPE jsonb USING 
  CASE 
    WHEN sources IS NULL THEN NULL
    ELSE to_jsonb(sources)
  END;