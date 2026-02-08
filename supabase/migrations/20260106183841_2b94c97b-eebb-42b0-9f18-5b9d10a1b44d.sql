-- Drop the SELECT policy for authenticated users on trust_scores
-- Access will now be exclusively through the get-trust-score edge function
DROP POLICY IF EXISTS "Authenticated users can view trust scores" ON public.trust_scores;