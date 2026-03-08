
-- Make voice-audio bucket private
UPDATE storage.buckets SET public = false WHERE id = 'voice-audio';

-- Drop the public SELECT policy and add authenticated-only SELECT
DROP POLICY IF EXISTS "Public access to voice-audio" ON storage.objects;

CREATE POLICY "Authenticated users can read voice-audio"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-audio');
