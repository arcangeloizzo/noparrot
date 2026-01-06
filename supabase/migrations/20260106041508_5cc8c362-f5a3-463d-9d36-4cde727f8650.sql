-- Create content_cache table for server-side content storage
-- This stores full text for Q/A generation without exposing to client
CREATE TABLE public.content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('article', 'youtube', 'spotify', 'twitter', 'tiktok', 'threads', 'linkedin', 'social')),
  content_text TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Index for fast lookup by URL
CREATE INDEX idx_content_cache_url ON public.content_cache(source_url);

-- Index for TTL cleanup
CREATE INDEX idx_content_cache_expires ON public.content_cache(expires_at);

-- Unique constraint on source_url to avoid duplicates (upsert pattern)
CREATE UNIQUE INDEX idx_content_cache_url_unique ON public.content_cache(source_url);

-- Enable RLS
ALTER TABLE public.content_cache ENABLE ROW LEVEL SECURITY;

-- NO policies = only service_role can access (edge functions)
-- Client cannot read this table at all