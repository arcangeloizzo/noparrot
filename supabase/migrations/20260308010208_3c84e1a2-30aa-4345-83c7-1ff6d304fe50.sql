
-- Add DELETE policy for voice_posts (allow post author to delete)
CREATE POLICY "Post author can delete voice_posts"
ON public.voice_posts
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT posts.author_id FROM posts WHERE posts.id = voice_posts.post_id
  )
  OR post_id IS NULL AND auth.uid() IN (
    SELECT cr.user_id FROM challenge_responses cr WHERE cr.voice_post_id = voice_posts.id
  )
);

-- Add DELETE policy for challenges (allow post author to delete)
CREATE POLICY "Post author can delete challenges"
ON public.challenges
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT posts.author_id FROM posts WHERE posts.id = challenges.post_id
  )
);

-- Make voice_posts.post_id CASCADE on delete
ALTER TABLE public.voice_posts
DROP CONSTRAINT voice_posts_post_id_fkey,
ADD CONSTRAINT voice_posts_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- Make challenges.post_id CASCADE on delete
ALTER TABLE public.challenges
DROP CONSTRAINT challenges_post_id_fkey,
ADD CONSTRAINT challenges_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- Make challenge_responses.challenge_id CASCADE on delete
ALTER TABLE public.challenge_responses
DROP CONSTRAINT challenge_responses_challenge_id_fkey,
ADD CONSTRAINT challenge_responses_challenge_id_fkey
  FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Make challenge_responses.voice_post_id CASCADE on delete
ALTER TABLE public.challenge_responses
DROP CONSTRAINT challenge_responses_voice_post_id_fkey,
ADD CONSTRAINT challenge_responses_voice_post_id_fkey
  FOREIGN KEY (voice_post_id) REFERENCES public.voice_posts(id) ON DELETE CASCADE;

-- Make challenge_votes.challenge_id CASCADE on delete
ALTER TABLE public.challenge_votes
DROP CONSTRAINT challenge_votes_challenge_id_fkey,
ADD CONSTRAINT challenge_votes_challenge_id_fkey
  FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Make challenge_votes.challenge_response_id CASCADE on delete
ALTER TABLE public.challenge_votes
DROP CONSTRAINT challenge_votes_challenge_response_id_fkey,
ADD CONSTRAINT challenge_votes_challenge_response_id_fkey
  FOREIGN KEY (challenge_response_id) REFERENCES public.challenge_responses(id) ON DELETE CASCADE;
