-- Tabella cache topics trending (payload pronto per UI)
CREATE TABLE IF NOT EXISTS public.trending_topics_cache (
  id bigserial PRIMARY KEY,
  window_hours int NOT NULL DEFAULT 168,
  sample_size int NOT NULL DEFAULT 80,
  min_clusters int NOT NULL DEFAULT 2,
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  input_snapshot jsonb NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trending_topics_cache_valid_until
ON public.trending_topics_cache (valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_trending_topics_cache_generated_at
ON public.trending_topics_cache (generated_at DESC);

-- RLS per trending_topics_cache
ALTER TABLE public.trending_topics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trending topics cache readable by everyone"
ON public.trending_topics_cache FOR SELECT
USING (true);

-- Tabella topic per clustering semantico
CREATE TABLE IF NOT EXISTS public.post_topics (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  topic_label text NOT NULL,
  macro_category text NULL,
  confidence numeric NOT NULL DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_topics_topic_id ON public.post_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_post_topics_created_at ON public.post_topics(created_at DESC);

-- RLS per post_topics
ALTER TABLE public.post_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post topics readable by everyone"
ON public.post_topics FOR SELECT
USING (true);