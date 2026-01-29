-- Aggiunge colonne per text extraction alla tabella media esistente
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_status TEXT DEFAULT 'idle';
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_kind TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_meta JSONB;

-- Aggiungi constraint CHECK come separati per evitare problemi se già esistono
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_extracted_status_check'
  ) THEN
    ALTER TABLE public.media ADD CONSTRAINT media_extracted_status_check 
      CHECK (extracted_status IN ('idle', 'pending', 'done', 'failed'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_extracted_kind_check'
  ) THEN
    ALTER TABLE public.media ADD CONSTRAINT media_extracted_kind_check 
      CHECK (extracted_kind IN ('ocr', 'transcript') OR extracted_kind IS NULL);
  END IF;
END $$;

-- Indice per query su media con estrazione completata
CREATE INDEX IF NOT EXISTS idx_media_extraction_status 
  ON public.media(extracted_status) WHERE extracted_status = 'done';

-- Commento sulla struttura di extracted_meta:
COMMENT ON COLUMN public.media.extracted_meta IS 'JSON with: language, confidence, chars, provider (gemini-vision/whisper-1), duration_sec';