-- ============================================
-- Comprehension Gate™ Tables
-- ============================================

-- Tabella per memorizzare le domande generate per ogni post/fonte
CREATE TABLE IF NOT EXISTS public.post_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  source_url TEXT,
  questions JSONB NOT NULL,
  correct_answers JSONB NOT NULL,
  generated_from TEXT DEFAULT 'gemini',
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, source_url)
);

-- Tabella per tracciare i tentativi degli utenti al comprehension gate
CREATE TABLE IF NOT EXISTS public.post_gate_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  source_url TEXT,
  answers JSONB NOT NULL,
  passed BOOLEAN NOT NULL,
  score INTEGER NOT NULL,
  gate_type TEXT NOT NULL,
  provider TEXT,
  completion_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_post_qa_post ON public.post_qa(post_id);
CREATE INDEX IF NOT EXISTS idx_post_qa_source ON public.post_qa(source_url);
CREATE INDEX IF NOT EXISTS idx_gate_attempts_user ON public.post_gate_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_attempts_post ON public.post_gate_attempts(post_id);

-- Enable Row Level Security
ALTER TABLE public.post_qa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_gate_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_qa
CREATE POLICY "Questions viewable by everyone"
  ON public.post_qa FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert questions"
  ON public.post_qa FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for post_gate_attempts
CREATE POLICY "Users can view own attempts"
  ON public.post_gate_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON public.post_gate_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);