
CREATE OR REPLACE FUNCTION public.get_public_post(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      FROM public.profiles pr WHERE pr.id = p.author_id
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
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_summary(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM public.profiles pr
  WHERE pr.id = p_user_id;
  RETURN result;
END;
$function$;
