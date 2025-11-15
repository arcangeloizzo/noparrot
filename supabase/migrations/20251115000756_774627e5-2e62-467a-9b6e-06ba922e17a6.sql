-- Create cache table for YouTube transcripts
CREATE TABLE IF NOT EXISTS public.youtube_transcripts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text UNIQUE NOT NULL,
  transcript text NOT NULL,
  source text NOT NULL,
  language text,
  cached_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups by video_id
CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_video_id 
ON public.youtube_transcripts_cache(video_id);

-- Enable RLS
ALTER TABLE public.youtube_transcripts_cache ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read from cache
CREATE POLICY "Anyone can read transcript cache"
ON public.youtube_transcripts_cache
FOR SELECT
USING (true);

-- Allow service role to write to cache (edge functions)
CREATE POLICY "Service role can insert transcripts"
ON public.youtube_transcripts_cache
FOR INSERT
WITH CHECK (true);