-- Create atomic function to find or create thread with exact participant set
CREATE OR REPLACE FUNCTION public.create_or_get_thread(participant_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  -- Find thread with EXACTLY these participants
  SELECT tp.thread_id INTO v_thread_id
  FROM thread_participants tp
  WHERE tp.user_id = ANY(participant_ids)
  GROUP BY tp.thread_id
  HAVING COUNT(DISTINCT tp.user_id) = array_length(participant_ids, 1)
    AND COUNT(DISTINCT tp.user_id) = (
      SELECT COUNT(*) 
      FROM thread_participants 
      WHERE thread_id = tp.thread_id
    )
  LIMIT 1;

  -- If no existing thread found, create new one
  IF v_thread_id IS NULL THEN
    INSERT INTO message_threads DEFAULT VALUES
    RETURNING id INTO v_thread_id;

    -- Add all participants atomically
    INSERT INTO thread_participants (thread_id, user_id)
    SELECT v_thread_id, unnest(participant_ids);
  END IF;

  RETURN v_thread_id;
END;
$$;