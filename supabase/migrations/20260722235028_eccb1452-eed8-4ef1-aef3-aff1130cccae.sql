
-- 1) Public post RPC (SECURITY DEFINER) — returns limited fields for guest reads
CREATE OR REPLACE FUNCTION public.get_public_post(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'author_id', p.author_id,
    'content', p.content,
    'topic_tag', p.topic_tag,
    'shared_title', p.shared_title,
    'shared_url', p.shared_url,
    'preview_img', p.preview_img,
    'trust_level', p.trust_level,
    'stance', p.stance,
    'sources', p.sources,
    'created_at', p.created_at,
    'quoted_post_id', p.quoted_post_id,
    'embed_html', p.embed_html,
    'category', p.category,
    'shares_count', p.shares_count,
    'is_intent', p.is_intent,
    'verified_by', p.verified_by,
    'hostname', p.hostname,
    'preview_fetched_at', p.preview_fetched_at,
    'post_type', p.post_type,
    'title', p.title,
    'legacy_category', p.legacy_category,
    'preview_img_width', p.preview_img_width,
    'preview_img_height', p.preview_img_height,
    'preview_img_ratio', p.preview_img_ratio,
    'preview_img_orientation', p.preview_img_orientation,
    'preview_img_ambient_url', p.preview_img_ambient_url,
    'is_removed', p.is_removed,
    'author', (
      SELECT jsonb_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url
      )
      FROM public.public_profiles pr WHERE pr.id = p.author_id
    ),
    'voice_post', (
      SELECT jsonb_build_object(
        'id', vp.id, 'audio_url', vp.audio_url,
        'duration_seconds', vp.duration_seconds,
        'waveform_data', vp.waveform_data,
        'transcript', vp.transcript,
        'transcript_status', vp.transcript_status,
        'title', vp.title, 'body_text', vp.body_text
      )
      FROM public.voice_posts vp WHERE vp.post_id = p.id LIMIT 1
    ),
    'challenge', (
      SELECT jsonb_build_object(
        'id', ch.id, 'thesis', ch.thesis,
        'duration_hours', ch.duration_hours,
        'status', ch.status,
        'expires_at', ch.expires_at,
        'votes_for', ch.votes_for,
        'votes_against', ch.votes_against,
        'title', ch.title, 'body_text', ch.body_text
      )
      FROM public.challenges ch WHERE ch.post_id = p.id LIMIT 1
    ),
    'questions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'options', q.options,
        'correct_index', q.correct_index,
        'order_index', q.order_index
      ) ORDER BY q.order_index), '[]'::jsonb)
      FROM public.questions q WHERE q.post_id = p.id
    ),
    'media', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', m.id, 'url', m.url, 'type', m.type,
        'width', m.width, 'height', m.height,
        'thumbnail_url', m.thumbnail_url,
        'mime', m.mime,
        'duration_sec', m.duration_sec,
        'extracted_status', m.extracted_status,
        'extracted_text', m.extracted_text,
        'extracted_kind', m.extracted_kind
      ) ORDER BY pm.order_idx), '[]'::jsonb)
      FROM public.post_media pm JOIN public.media m ON m.id = pm.media_id WHERE pm.post_id = p.id
    ),
    'reactions_by_type', (
      SELECT COALESCE(jsonb_object_agg(reaction_type, cnt), '{}'::jsonb)
      FROM (
        SELECT reaction_type, COUNT(*)::int AS cnt
        FROM public.reactions
        WHERE post_id = p.id AND reaction_type <> 'bookmark'
        GROUP BY reaction_type
      ) s
    ),
    'comments_count', (SELECT COUNT(*)::int FROM public.comments c WHERE c.post_id = p.id AND COALESCE(c.is_removed,false)=false)
  ) INTO result
  FROM public.posts p
  WHERE p.id = p_id AND COALESCE(p.is_removed, false) = false;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_post(uuid) TO anon, authenticated;

-- 2) Public profile summary RPC
CREATE OR REPLACE FUNCTION public.get_public_profile_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', pr.id,
    'username', pr.username,
    'full_name', pr.full_name,
    'avatar_url', pr.avatar_url,
    'bio', pr.bio,
    'is_ai_institutional', pr.is_ai_institutional,
    'created_at', pr.created_at,
    'followers_count', (SELECT COUNT(*)::int FROM public.followers WHERE following_id = pr.id),
    'following_count', (SELECT COUNT(*)::int FROM public.followers WHERE follower_id = pr.id),
    'posts_count', (SELECT COUNT(*)::int FROM public.posts WHERE author_id = pr.id AND COALESCE(is_removed,false)=false),
    'comprehension_count', public.get_user_comprehension_count(pr.id),
    'cognitive_density', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'macro_category', ucd.macro_category,
        'density', ucd.density,
        'action_breakdown', ucd.action_breakdown
      ) ORDER BY ucd.density DESC)
      FROM public.user_cognitive_density ucd
      WHERE ucd.user_id = pr.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.public_profiles pr
  WHERE pr.id = p_user_id;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_summary(uuid) TO anon, authenticated;

-- 3) Timeframe cognitive density RPC
CREATE OR REPLACE FUNCTION public.get_user_cognitive_density_timeframe(
  p_user_id uuid,
  p_since timestamptz,
  p_until timestamptz
)
RETURNS TABLE(macro_category text, density numeric, action_breakdown jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH weights AS (
    SELECT action_type, weight FROM public.cognitive_weights_config WHERE is_active = true
  ),
  events AS (
    -- post_original
    SELECT p.category AS macro, 'post_original'::text AS action_type
    FROM public.posts p
    WHERE p.author_id = p_user_id
      AND p.quoted_post_id IS NULL
      AND p.is_intent IS NOT TRUE
      AND COALESCE(p.post_type::text,'standard') = 'standard'
      AND p.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND p.created_at >= p_since AND p.created_at < p_until

    UNION ALL
    -- voice_post
    SELECT p.category, 'voice_post'
    FROM public.posts p
    WHERE p.author_id = p_user_id
      AND p.post_type::text = 'voice'
      AND p.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND p.created_at >= p_since AND p.created_at < p_until

    UNION ALL
    -- challenge_started
    SELECT p.category, 'challenge_started'
    FROM public.posts p
    WHERE p.author_id = p_user_id
      AND p.post_type::text = 'challenge'
      AND p.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND p.created_at >= p_since AND p.created_at < p_until

    UNION ALL
    -- reshare_with_comment
    SELECT qp.category, 'reshare_with_comment'
    FROM public.posts p JOIN public.posts qp ON qp.id = p.quoted_post_id
    WHERE p.author_id = p_user_id
      AND p.quoted_post_id IS NOT NULL
      AND p.is_intent IS NOT TRUE
      AND qp.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND p.created_at >= p_since AND p.created_at < p_until
      AND COALESCE(array_length(string_to_array(trim(COALESCE(p.content,'')), ' '),1),0) > 30

    UNION ALL
    -- reshare_simple
    SELECT qp.category, 'reshare_simple'
    FROM public.posts p LEFT JOIN public.posts qp ON qp.id = p.quoted_post_id
    WHERE p.author_id = p_user_id
      AND (p.quoted_post_id IS NOT NULL OR p.is_intent = true)
      AND qp.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND p.created_at >= p_since AND p.created_at < p_until
      AND COALESCE(array_length(string_to_array(trim(COALESCE(p.content,'')), ' '),1),0) <= 30

    UNION ALL
    -- gate_passed_only (no commento)
    SELECT p.category, 'gate_passed_only'
    FROM public.post_gate_attempts pga JOIN public.posts p ON p.id = pga.post_id
    WHERE pga.user_id = p_user_id
      AND pga.passed = true
      AND p.category IS NOT NULL
      AND COALESCE(p.is_removed,false) = false
      AND pga.created_at >= p_since AND pga.created_at < p_until
      AND NOT EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.post_id = pga.post_id AND c.author_id = pga.user_id
          AND c.passed_gate = true AND COALESCE(c.is_removed,false) = false
      )

    UNION ALL
    -- comment_with_gate
    SELECT c.post_category, 'comment_with_gate'
    FROM public.comments c
    WHERE c.author_id = p_user_id
      AND c.passed_gate = true
      AND c.post_category IS NOT NULL
      AND COALESCE(c.is_removed,false) = false
      AND c.created_at >= p_since AND c.created_at < p_until
  ),
  weighted AS (
    SELECT e.macro, e.action_type, w.weight
    FROM events e LEFT JOIN weights w ON w.action_type = e.action_type
  ),
  by_macro AS (
    SELECT macro,
           SUM(COALESCE(weight,0))::numeric AS density,
           jsonb_object_agg(action_type, cnt) AS action_breakdown
    FROM (
      SELECT macro, action_type, COUNT(*)::int AS cnt, MAX(weight) AS weight
      FROM weighted
      GROUP BY macro, action_type
    ) s
    GROUP BY macro
  )
  SELECT macro AS macro_category, density, action_breakdown
  FROM by_macro
  WHERE density > 0
  ORDER BY density DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cognitive_density_timeframe(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- 4) Indexes for timeframe queries
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pga_user_created ON public.post_gate_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author_created ON public.comments (author_id, created_at DESC);
