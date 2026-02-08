-- Aggiunge la colonna 'passed_gate' alla tabella dei commenti
-- Questa colonna traccerà se l'utente ha superato il Comprehension Gate
-- della fonte del post PRIMA di pubblicare questo commento.
--
-- Il valore di default è FALSE, che si applica a:
-- 1. Tutti i commenti esistenti (presumiamo non abbiano letto la fonte con il gate).
-- 2. Nuovi commenti su post SENZA fonte.
-- 3. Nuovi commenti "a caldo" (pappagallo giallo) su post CON fonte.
ALTER TABLE public.comments
ADD COLUMN passed_gate BOOLEAN NOT NULL DEFAULT FALSE;

-- Aggiungiamo un commento sulla colonna per chiarezza nello schema
COMMENT ON COLUMN public.comments.passed_gate IS 'True se l''utente ha superato il Comprehension Gate della fonte del post prima di commentare.';