-- Crea bucket user-media con limite 100MB e supporto video + immagini
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media', 
  true,
  104857600,  -- 100 MB
  ARRAY[
    -- Immagini
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    -- Video
    'video/mp4', 'video/quicktime', 'video/mov', 'video/webm', 'video/mpeg', 'video/3gpp'
  ]
);

-- Policy RLS per upload - solo owner può caricare nella propria cartella
CREATE POLICY "Users can upload to user-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy RLS per lettura pubblica (il bucket è public)
CREATE POLICY "Public read access user-media" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'user-media');

-- Policy RLS per delete - solo owner può eliminare i propri file
CREATE POLICY "Users can delete own user-media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);