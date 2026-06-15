
-- Compliance copyright: restrict client access to third-party content columns on posts.
-- PostgreSQL requires revoking table-level SELECT and granting column-level SELECT
-- on the allowed columns, because table-level grants supersede column-level revokes.

-- 1. Revoke table-level SELECT from authenticated and anon (INSERT/UPDATE/DELETE preserved, governed by RLS)
REVOKE SELECT ON public.posts FROM authenticated;
REVOKE SELECT ON public.posts FROM anon;

-- 2. Grant column-level SELECT on all non-sensitive columns to authenticated
GRANT SELECT (
  id, author_id, content, topic_tag, shared_title, shared_url, preview_img,
  trust_level, stance, sources, created_at, quoted_post_id, embed_html,
  category, shares_count, is_intent, verified_by, hostname, preview_fetched_at,
  post_type, is_removed, removed_reason, removed_at, removed_by, title,
  legacy_category, preview_img_width, preview_img_height, preview_img_ratio,
  preview_img_orientation, preview_img_ambient_url
) ON public.posts TO authenticated;

-- 3. Grant the same set to anon (same columns currently visible publicly under RLS)
GRANT SELECT (
  id, author_id, content, topic_tag, shared_title, shared_url, preview_img,
  trust_level, stance, sources, created_at, quoted_post_id, embed_html,
  category, shares_count, is_intent, verified_by, hostname, preview_fetched_at,
  post_type, is_removed, removed_reason, removed_at, removed_by, title,
  legacy_category, preview_img_width, preview_img_height, preview_img_ratio,
  preview_img_orientation, preview_img_ambient_url
) ON public.posts TO anon;

-- 4. Ensure service_role retains full access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;

-- 5. Documentation / audit trail
COMMENT ON COLUMN public.posts.article_content   IS 'Third-party scraped content. SERVICE_ROLE access only. Compliance copyright.';
COMMENT ON COLUMN public.posts.transcript        IS 'Third-party transcription. SERVICE_ROLE access only. Compliance copyright.';
COMMENT ON COLUMN public.posts.full_article      IS 'Legacy third-party content. SERVICE_ROLE access only. Compliance copyright.';
COMMENT ON COLUMN public.posts.transcript_source IS 'Third-party transcription source metadata. SERVICE_ROLE access only.';
