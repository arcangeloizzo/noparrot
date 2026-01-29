-- Step 1: Create the new table for sensitive cognitive metrics
CREATE TABLE public.comment_cognitive_metrics (
  comment_id UUID PRIMARY KEY REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  density_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comment_cognitive_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own metrics
CREATE POLICY "Users can view own comment metrics"
ON public.comment_cognitive_metrics
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own metrics
CREATE POLICY "Users can insert own comment metrics"
ON public.comment_cognitive_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access for backend operations
CREATE POLICY "Service role can manage comment metrics"
ON public.comment_cognitive_metrics
FOR ALL
USING (true)
WITH CHECK (true);

-- Step 2: Migrate existing data from comments to new table
INSERT INTO public.comment_cognitive_metrics (comment_id, user_id, density_data, created_at)
SELECT 
  c.id,
  c.author_id,
  c.user_density_before_comment,
  c.created_at
FROM public.comments c
WHERE c.user_density_before_comment IS NOT NULL
ON CONFLICT (comment_id) DO NOTHING;

-- NOTE: NOT dropping the old column yet - will do after code update is confirmed