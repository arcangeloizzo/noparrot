
-- Add allow_multiple column to polls
ALTER TABLE public.polls ADD COLUMN allow_multiple boolean NOT NULL DEFAULT false;

-- Drop existing unique constraint on poll_votes (poll_id, user_id) if it exists
DO $$
BEGIN
  -- Try dropping common constraint names
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poll_votes_poll_id_user_id_key' AND conrelid = 'public.poll_votes'::regclass) THEN
    ALTER TABLE public.poll_votes DROP CONSTRAINT poll_votes_poll_id_user_id_key;
  END IF;
END $$;

-- Drop any unique index on (poll_id, user_id)
DROP INDEX IF EXISTS public.poll_votes_poll_id_user_id_key;
DROP INDEX IF EXISTS public.poll_votes_poll_id_user_id_idx;

-- Add new unique constraint on (poll_id, user_id, option_id) to allow multi-select
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_poll_user_option_unique UNIQUE (poll_id, user_id, option_id);
