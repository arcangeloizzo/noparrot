-- Remove char_length constraint from challenges.thesis column
-- Since the constraint was created inline without a name, we use a PL/pgSQL block
-- to find its name dynamically and drop it.

DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- Find the constraint name related to the thesis column check
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.challenges'::regclass
    AND contype = 'c'
    AND (
      pg_get_constraintdef(oid) LIKE '%char_length%(%thesis%)%<=%140%' OR
      pg_get_constraintdef(oid) LIKE '%length%(%thesis%)%<=%140%'
    );

  -- Drop the constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.challenges DROP CONSTRAINT ' || quote_ident(constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'Constraint on challenges.thesis not found or already dropped.';
  END IF;
END $$;
