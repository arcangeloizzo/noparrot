-- Trigger BEFORE INSERT su public.comments per blindare passed_gate
CREATE OR REPLACE FUNCTION public.enforce_comment_passed_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_has_passed boolean;
BEGIN
  IF COALESCE(NEW.passed_gate, false) = false THEN
    RETURN NEW;
  END IF;

  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- L'autore del post è sempre autorizzato
  IF v_post_author_id IS NOT NULL AND v_post_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Altrimenti serve una riga passed=true in post_gate_attempts
  SELECT EXISTS (
    SELECT 1 FROM public.post_gate_attempts
    WHERE user_id = NEW.author_id
      AND post_id = NEW.post_id
      AND passed = true
  ) INTO v_has_passed;

  IF NOT v_has_passed THEN
    NEW.passed_gate := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_passed_gate_trigger ON public.comments;
CREATE TRIGGER enforce_comment_passed_gate_trigger
BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_passed_gate();