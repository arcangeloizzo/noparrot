
CREATE INDEX IF NOT EXISTS idx_messages_thread_created_desc
  ON public.messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thread_participants_user_thread
  ON public.thread_participants (user_id, thread_id);

CREATE OR REPLACE FUNCTION public.get_thread_overviews(p_limit integer DEFAULT 20)
RETURNS TABLE (
  thread_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  participants jsonb,
  last_message jsonb,
  unread_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_threads AS (
    SELECT tp.thread_id, tp.last_read_at
    FROM public.thread_participants tp, me
    WHERE tp.user_id = me.uid
  ),
  thread_last AS (
    SELECT
      mt.thread_id,
      lm.id AS last_id,
      lm.content AS last_content,
      lm.created_at AS last_created_at,
      lm.sender_id AS last_sender_id
    FROM my_threads mt
    LEFT JOIN LATERAL (
      SELECT m.id, m.content, m.created_at, m.sender_id
      FROM public.messages m
      WHERE m.thread_id = mt.thread_id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON TRUE
  )
  SELECT
    t.id AS thread_id,
    t.created_at,
    t.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tp.id,
        'user_id', tp.user_id,
        'last_read_at', tp.last_read_at,
        'profile', jsonb_build_object(
          'id', pr.id,
          'username', pr.username,
          'full_name', pr.full_name,
          'avatar_url', pr.avatar_url,
          'last_seen_at', NULL
        )
      ))
      FROM public.thread_participants tp
      LEFT JOIN public.profiles pr ON pr.id = tp.user_id
      WHERE tp.thread_id = t.id
    ), '[]'::jsonb) AS participants,
    CASE
      WHEN tl.last_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', tl.last_id,
        'content', tl.last_content,
        'created_at', tl.last_created_at,
        'sender_id', tl.last_sender_id
      )
    END AS last_message,
    COALESCE((
      SELECT COUNT(*)::int
      FROM public.messages m
      WHERE m.thread_id = t.id
        AND m.sender_id <> (SELECT uid FROM me)
        AND (
          mt.last_read_at IS NULL
          OR m.created_at > mt.last_read_at
        )
    ), 0) AS unread_count
  FROM public.message_threads t
  JOIN my_threads mt ON mt.thread_id = t.id
  LEFT JOIN thread_last tl ON tl.thread_id = t.id
  ORDER BY COALESCE(tl.last_created_at, t.updated_at) DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_thread_overviews(integer) TO authenticated;
