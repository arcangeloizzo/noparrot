CREATE OR REPLACE FUNCTION public.verify_challenge_gate_passed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    has_passed BOOLEAN;
    parent_post_id UUID;
BEGIN
    SELECT post_id
    INTO parent_post_id
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    IF parent_post_id IS NULL THEN
        RAISE EXCEPTION 'Challenge non valida: post associato non trovato.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.post_gate_attempts
        WHERE user_id = NEW.user_id
          AND post_id = parent_post_id
          AND passed = true
    ) INTO has_passed;

    IF NOT has_passed THEN
        RAISE EXCEPTION 'Accesso negato: devi superare il Comprehension Gate prima di rispondere alla sfida.';
    END IF;

    NEW.gate_passed := true;

    RETURN NEW;
END;
$function$;