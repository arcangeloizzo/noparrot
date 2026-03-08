-- 1. Rimuoviamo la vecchia policy che si fidava del client
DROP POLICY "Authenticated users can insert challenge_responses if passed ga" ON challenge_responses;

-- 2. Creiamo una nuova policy più rigida: l'utente può inserire solo per se stesso
-- Il controllo sul Gate avverrà nel trigger sottostante
CREATE POLICY "Authenticated users can insert own challenge_responses" 
ON challenge_responses
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Funzione SECURITY DEFINER per verificare il superamento del Gate
CREATE OR REPLACE FUNCTION verify_challenge_gate_passed()
RETURNS TRIGGER AS $$
DECLARE
    has_passed BOOLEAN;
BEGIN
    -- Verifichiamo se esiste un tentativo superato (score >= 60) per questo utente e questo post
    -- post_gate_attempts è la tabella che registra i risultati dei quiz
    SELECT EXISTS (
        SELECT 1 
        FROM post_gate_attempts 
        WHERE user_id = auth.uid() 
          AND post_id = (SELECT post_id FROM challenges WHERE id = NEW.challenge_id)
          AND score >= 60
    ) INTO has_passed;

    -- Se non ha passato il gate, blocchiamo l'inserimento
    IF NOT has_passed THEN
        RAISE EXCEPTION 'Accesso negato: devi superare il Comprehension Gate prima di rispondere alla sfida.';
    END IF;

    -- Forziamo il valore di gate_passed a true (sovrascrivendo l'eventuale input fraudolento del client)
    NEW.gate_passed := true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Eseguita con privilegi elevati per leggere post_gate_attempts

-- 4. Applichiamo il trigger alla tabella challenge_responses
CREATE TRIGGER check_gate_before_challenge_response
    BEFORE INSERT ON challenge_responses
    FOR EACH ROW
    EXECUTE FUNCTION verify_challenge_gate_passed();