CREATE TABLE IF NOT EXISTS public.reclassification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  previous_category text,
  new_category text,
  source_snippet text,
  source_breakdown jsonb,
  ai_raw_response text,
  decision text NOT NULL CHECK (decision IN ('reclassified', 'skipped_short', 'skipped_invalid_ai', 'error')),
  error_message text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reclass_audit_post_id ON public.reclassification_audit(post_id);
CREATE INDEX IF NOT EXISTS idx_reclass_audit_processed_at ON public.reclassification_audit(processed_at DESC);

ALTER TABLE public.reclassification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages reclassification audit"
  ON public.reclassification_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view reclassification audit"
  ON public.reclassification_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));