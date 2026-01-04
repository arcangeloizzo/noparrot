-- Aggiungere colonna edition_time alla tabella daily_focus
ALTER TABLE daily_focus 
ADD COLUMN IF NOT EXISTS edition_time TEXT;

-- Aggiornare articoli esistenti con un valore di default basato su created_at
UPDATE daily_focus 
SET edition_time = TO_CHAR(created_at AT TIME ZONE 'Europe/Rome', 'HH12:MI am')
WHERE edition_time IS NULL;