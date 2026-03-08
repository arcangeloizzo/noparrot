CREATE OR REPLACE FUNCTION verify_challenge_gate_passed()
RETURNS TRIGGER AS $$
DECLARE
    has_passed BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.post_gate_attempts 
        WHERE user_id = auth.uid() 
          AND post_id = (SELECT post_id FROM public.challenges WHERE id = NEW.challenge_id)
          AND score >= 60
    ) INTO has_passed;

    IF NOT has_passed THEN
        RAISE EXCEPTION 'Accesso negato: devi superare il Comprehension Gate prima di rispondere alla sfida.';
    END IF;

    NEW.gate_passed := true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;