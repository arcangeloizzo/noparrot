CREATE OR REPLACE FUNCTION public.enqueue_ai_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_record record;
BEGIN
  FOR profile_record IN
    SELECT id, handle FROM ai_profiles
    WHERE is_active = true
      AND NEW.content ~* ('(^|[^a-z0-9_])@' || handle || '([^a-z0-9_]|$)')
  LOOP
    INSERT INTO ai_mention_queue (
      profile_id,
      mentioning_user_id,
      source_comment_id,
      source_post_id,
      context_payload
    ) VALUES (
      profile_record.id,
      NEW.author_id,
      NEW.id,
      NEW.post_id,
      jsonb_build_object(
        'mentioned_handle', profile_record.handle,
        'comment_content', NEW.content,
        'inserted_at', now()
      )
    )
    ON CONFLICT (source_comment_id, profile_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;