-- Fix existing comment levels with a working recursive update
-- First, set all top-level comments to level 0
UPDATE public.comments
SET level = 0
WHERE parent_id IS NULL;

-- Then update nested comments level by level
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Keep updating until no more changes
  LOOP
    UPDATE public.comments c1
    SET level = (
      SELECT c2.level + 1
      FROM public.comments c2
      WHERE c2.id = c1.parent_id
    )
    WHERE c1.parent_id IS NOT NULL
      AND c1.level != COALESCE((
        SELECT c2.level + 1
        FROM public.comments c2
        WHERE c2.id = c1.parent_id
      ), 0);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    EXIT WHEN updated_count = 0;
  END LOOP;
END $$;