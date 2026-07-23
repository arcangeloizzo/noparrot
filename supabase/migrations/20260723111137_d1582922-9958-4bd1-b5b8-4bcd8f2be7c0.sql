
-- Add slug column to posts with unique partial index and generation logic
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_key ON public.posts (slug) WHERE slug IS NOT NULL;

-- Base slugifier: no accents, lowercase, [a-z0-9]+/-, trimmed, max 60 chars on word boundary
CREATE OR REPLACE FUNCTION public.slugify_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s text;
  cut int;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  s := lower(input);
  -- Strip accents (common Latin diacritics)
  s := translate(s,
    'àáâãäåāăąèéêëēĕėęěìíîïĩīĭįòóôõöøōŏőùúûüũūŭůűųñńçćčšśžźżýÿ',
    'aaaaaaaaaeeeeeeeeeiiiiiiiiooooooooouuuuuuuuuunncccsszzzyy');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := btrim(s, '-');
  IF s = '' THEN RETURN NULL; END IF;
  IF length(s) > 60 THEN
    -- try to cut on a hyphen boundary within first 60 chars
    cut := 60;
    WHILE cut > 30 AND substr(s, cut, 1) <> '-' LOOP
      cut := cut - 1;
    END LOOP;
    IF cut <= 30 THEN cut := 60; END IF;
    s := btrim(substr(s, 1, cut), '-');
  END IF;
  IF s = '' THEN RETURN NULL; END IF;
  RETURN s;
END;
$$;

-- Build a slug candidate from a post's title/content, with collision fallback using id suffix
CREATE OR REPLACE FUNCTION public.generate_post_slug(p_title text, p_content text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  raw text;
  base text;
  candidate text;
  words text[];
BEGIN
  IF p_title IS NOT NULL AND btrim(p_title) <> '' THEN
    raw := p_title;
  ELSE
    -- first ~8 words of content
    words := regexp_split_to_array(btrim(coalesce(p_content, '')), '\s+');
    IF array_length(words, 1) IS NULL THEN
      RETURN NULL;
    END IF;
    raw := array_to_string(words[1:LEAST(8, array_length(words,1))], ' ');
  END IF;

  base := public.slugify_text(raw);
  IF base IS NULL THEN RETURN NULL; END IF;

  candidate := base;
  IF EXISTS (SELECT 1 FROM public.posts WHERE slug = candidate AND id <> COALESCE(p_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    candidate := base || '-' || substr(replace(COALESCE(p_id::text, gen_random_uuid()::text), '-', ''), 1, 6);
  END IF;
  RETURN candidate;
END;
$$;

-- BEFORE INSERT trigger: assign slug once, never touch on updates
CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_post_slug(NEW.title, NEW.content, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_post_slug ON public.posts;
CREATE TRIGGER trg_set_post_slug
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_slug();

-- Backfill existing rows in deterministic order (older first, so newer collisions get -id6 suffix)
DO $$
DECLARE r record; cand text;
BEGIN
  FOR r IN SELECT id, title, content FROM public.posts WHERE slug IS NULL ORDER BY created_at ASC LOOP
    cand := public.generate_post_slug(r.title, r.content, r.id);
    IF cand IS NOT NULL THEN
      BEGIN
        UPDATE public.posts SET slug = cand WHERE id = r.id;
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.posts SET slug = cand || '-' || substr(replace(r.id::text, '-', ''), 1, 6) WHERE id = r.id;
      END;
    END IF;
  END LOOP;
END $$;

-- Resolver: slug -> uuid (accessible to anon; does not expose row data)
CREATE OR REPLACE FUNCTION public.resolve_post_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.posts WHERE slug = p_slug AND COALESCE(is_removed, false) = false LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_post_slug(text) TO anon, authenticated;

-- Update get_public_post to include slug in output
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
    'slug', p.slug,
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
