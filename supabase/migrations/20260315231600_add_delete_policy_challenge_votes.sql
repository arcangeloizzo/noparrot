-- Add DELETE policy for challenge_votes to allow users to remove their own vote
CREATE POLICY "Users can delete own challenge_votes"
ON public.challenge_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add a trigger to decrement argument_votes when a vote is deleted
CREATE OR REPLACE FUNCTION decrement_argument_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenge_responses
  SET argument_votes = GREATEST(0, argument_votes - 1)
  WHERE id = OLD.challenge_response_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_challenge_vote_delete ON challenge_votes;
CREATE TRIGGER on_challenge_vote_delete
  AFTER DELETE ON challenge_votes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_argument_votes();
