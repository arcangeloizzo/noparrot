-- Hardening RLS: Remove public SELECT from cache tables

-- 1. youtube_transcripts_cache: remove public SELECT (only service_role access)
DROP POLICY IF EXISTS "Anyone can read transcript cache" ON public.youtube_transcripts_cache;

-- 2. trust_scores: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Trust scores viewable by everyone" ON public.trust_scores;

CREATE POLICY "Authenticated users can view trust scores"
  ON public.trust_scores
  FOR SELECT
  TO authenticated
  USING (true);