-- Aggiunta campi per titolo (Impact obbligatorio) e corpo (opzionale) in VoiceCast e Challenge
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS body_text TEXT;
