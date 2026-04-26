-- Step 1: Sync divergent macro_category in post_topics with current posts.category
UPDATE public.post_topics pt
SET macro_category = p.category
FROM public.posts p
WHERE pt.post_id = p.id
  AND pt.macro_category IS DISTINCT FROM p.category;

-- Step 4 prep: extend reclassification_audit.decision check constraint
ALTER TABLE public.reclassification_audit
  DROP CONSTRAINT IF EXISTS reclassification_audit_decision_check;

ALTER TABLE public.reclassification_audit
  ADD CONSTRAINT reclassification_audit_decision_check
  CHECK (decision IN (
    'reclassified',
    'skipped_short',
    'skipped_invalid_ai',
    'error',
    'topic_assigned',
    'topic_skipped',
    'topic_error'
  ));