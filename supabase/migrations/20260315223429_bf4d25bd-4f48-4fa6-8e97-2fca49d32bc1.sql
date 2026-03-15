CREATE OR REPLACE FUNCTION public.decrement_argument_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE challenge_responses
  SET argument_votes = GREATEST(0, argument_votes - 1)
  WHERE id = OLD.challenge_response_id;
  RETURN OLD;
END;
$$;