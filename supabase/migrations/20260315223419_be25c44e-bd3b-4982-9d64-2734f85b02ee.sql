-- 1. Add DELETE policy for challenge_votes to allow users to remove their own vote
CREATE POLICY "Users can delete own challenge_votes"
ON public.challenge_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Add a trigger to decrement argument_votes when a vote is deleted
CREATE OR REPLACE FUNCTION public.decrement_argument_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenge_responses
  SET argument_votes = GREATEST(0, argument_votes - 1)
  WHERE id = OLD.challenge_response_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_challenge_vote_delete ON public.challenge_votes;
CREATE TRIGGER on_challenge_vote_delete
  AFTER DELETE ON public.challenge_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_argument_votes();

-- 3. Remove char_length constraint from challenges.thesis column dynamically
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.challenges'::regclass
    AND contype = 'c'
    AND (
      pg_get_constraintdef(oid) LIKE '%char_length%(%thesis%)%<=%140%' OR
      pg_get_constraintdef(oid) LIKE '%length%(%thesis%)%<=%140%'
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.challenges DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;