-- Create the share-previews storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('share-previews', 'share-previews', true, 52428, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

-- Policy: service role can upload
CREATE POLICY "Service role can upload share previews"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'share-previews');

-- Policy: public read
CREATE POLICY "Public can read share previews"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'share-previews');

-- Policy: service role can update (upsert)
CREATE POLICY "Service role can update share previews"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'share-previews');