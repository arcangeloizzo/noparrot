-- Cambia il default di consent_version a '2.0'
ALTER TABLE user_consents ALTER COLUMN consent_version SET DEFAULT '2.0';

-- Aggiungi policy DELETE su message_deletions per permettere all'utente di annullare la cancellazione
CREATE POLICY "Users can delete own message deletions"
ON message_deletions FOR DELETE
USING (auth.uid() = user_id);