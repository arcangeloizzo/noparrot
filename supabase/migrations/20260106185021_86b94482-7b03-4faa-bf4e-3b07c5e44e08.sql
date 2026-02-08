-- ============================================================================
-- HARDENING post_qa: Split into public/private tables
-- NOTE: post_qa_public exists as a VIEW, we use new table names
-- ============================================================================

-- 1. Drop existing view first
DROP VIEW IF EXISTS public.post_qa_public;

-- 2. Create post_qa_answers table (ONLY correct_answers, accessible via service_role)
CREATE TABLE public.post_qa_answers (
  id uuid NOT NULL PRIMARY KEY,
  correct_answers jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Create post_qa_questions table (questions only, owner-based access)
CREATE TABLE public.post_qa_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  source_url text,
  questions jsonb NOT NULL,
  test_mode text,
  content_hash text,
  generated_at timestamp with time zone DEFAULT now(),
  generated_from text DEFAULT 'gemini',
  owner_id uuid NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  CONSTRAINT post_qa_questions_content_check CHECK (post_id IS NOT NULL OR source_url IS NOT NULL)
);

-- 4. Add foreign key from answers to questions (cascade delete)
ALTER TABLE public.post_qa_answers 
  ADD CONSTRAINT post_qa_answers_id_fkey 
  FOREIGN KEY (id) REFERENCES public.post_qa_questions(id) ON DELETE CASCADE;

-- 5. Create indexes for efficient lookups
CREATE INDEX idx_post_qa_questions_source_url ON public.post_qa_questions(source_url);
CREATE INDEX idx_post_qa_questions_post_id ON public.post_qa_questions(post_id);
CREATE INDEX idx_post_qa_questions_owner_id ON public.post_qa_questions(owner_id);
CREATE INDEX idx_post_qa_questions_expires_at ON public.post_qa_questions(expires_at);

-- 6. RLS on post_qa_questions: owner can read own Q&A
ALTER TABLE public.post_qa_questions ENABLE ROW LEVEL SECURITY;

-- Only owner can read their own Q&A
CREATE POLICY "Users can read own Q&A"
ON public.post_qa_questions FOR SELECT
USING (owner_id = auth.uid());

-- No direct INSERT/UPDATE/DELETE from client - only via edge functions

-- 7. RLS on post_qa_answers: NO access for anon/authenticated
ALTER TABLE public.post_qa_answers ENABLE ROW LEVEL SECURITY;
-- No policies = no access from client. Only service_role can access.

-- 8. Rate limiting table for submit-qa
CREATE TABLE public.qa_submit_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  qa_id uuid NOT NULL REFERENCES public.post_qa_questions(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_qa_submit_attempts_user_qa ON public.qa_submit_attempts(user_id, qa_id);

ALTER TABLE public.qa_submit_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = service_role only access

-- 9. Backfill data from post_qa to new tables
INSERT INTO public.post_qa_questions (id, post_id, source_url, questions, test_mode, content_hash, generated_at, generated_from, owner_id)
SELECT 
  pq.id,
  pq.post_id,
  pq.source_url,
  pq.questions,
  pq.test_mode,
  pq.content_hash,
  pq.generated_at,
  pq.generated_from,
  COALESCE(p.author_id, '00000000-0000-0000-0000-000000000000'::uuid) as owner_id
FROM public.post_qa pq
LEFT JOIN public.posts p ON pq.post_id = p.id
WHERE pq.questions IS NOT NULL;

INSERT INTO public.post_qa_answers (id, correct_answers)
SELECT pq.id, pq.correct_answers
FROM public.post_qa pq
WHERE pq.correct_answers IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.post_qa_questions pqq WHERE pqq.id = pq.id);

-- 10. Drop all existing RLS policies on post_qa to prevent client access
DROP POLICY IF EXISTS "Edge functions can read post_qa for valid content" ON public.post_qa;
DROP POLICY IF EXISTS "Edge functions can insert post_qa with required fields" ON public.post_qa;
DROP POLICY IF EXISTS "Edge functions can update existing post_qa" ON public.post_qa;

-- 11. Add restrictive policy on legacy post_qa - no client access
CREATE POLICY "No client access to legacy post_qa"
ON public.post_qa FOR SELECT
USING (false);