-- Tabella per cachare i trust scores
CREATE TABLE IF NOT EXISTS public.trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  band TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Index per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_trust_scores_url ON public.trust_scores(source_url);
CREATE INDEX IF NOT EXISTS idx_trust_scores_expires_at ON public.trust_scores(expires_at);

-- RLS policies
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trust scores viewable by everyone"
  ON public.trust_scores FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert trust scores"
  ON public.trust_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update trust scores"
  ON public.trust_scores FOR UPDATE
  USING (true);