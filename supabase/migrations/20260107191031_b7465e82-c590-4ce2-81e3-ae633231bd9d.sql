-- =====================================================
-- Fix Security Issues: RLS Policies
-- =====================================================

-- 1. Add policies for tables with RLS enabled but no policies
-- =====================================================

-- content_cache: Service-only table for caching content
-- No user policies needed - service role accesses via edge functions
CREATE POLICY "Service role manages content cache"
  ON public.content_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- post_qa_answers: Linked to post_qa_questions, owner-based access
-- Users can view answers for their own questions
CREATE POLICY "Users can view own question answers"
  ON public.post_qa_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.post_qa_questions q
      WHERE q.id = post_qa_answers.id
      AND q.owner_id = auth.uid()
    )
  );

-- Service role can manage all answers (for edge functions)
CREATE POLICY "Service role manages answers"
  ON public.post_qa_answers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- qa_submit_attempts: User's own attempt tracking
CREATE POLICY "Users can view own attempts"
  ON public.qa_submit_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON public.qa_submit_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
  ON public.qa_submit_attempts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Fix overly permissive service role policies
-- Drop and recreate with explicit TO service_role
-- =====================================================

-- daily_focus: Change from public to service_role only
DROP POLICY IF EXISTS "Service role can manage daily focus" ON public.daily_focus;
CREATE POLICY "Service role can manage daily focus"
  ON public.daily_focus
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- interest_focus: Change from public to service_role only
DROP POLICY IF EXISTS "Service role can manage interest focus" ON public.interest_focus;
CREATE POLICY "Service role can manage interest focus"
  ON public.interest_focus
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trust_scores: Change from public to service_role only
DROP POLICY IF EXISTS "Service role can insert trust scores" ON public.trust_scores;
DROP POLICY IF EXISTS "Service role can update trust scores" ON public.trust_scores;
CREATE POLICY "Service role can insert trust scores"
  ON public.trust_scores
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update trust scores"
  ON public.trust_scores
  FOR UPDATE
  TO service_role
  USING (true);

-- youtube_transcripts_cache: Change from public to service_role only
DROP POLICY IF EXISTS "Service role can insert transcripts" ON public.youtube_transcripts_cache;
CREATE POLICY "Service role can insert transcripts"
  ON public.youtube_transcripts_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);