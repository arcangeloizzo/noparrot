-- Create storage bucket for AI-generated news images
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to news images
CREATE POLICY "News images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'news-images');

-- Allow service role to upload images (edge functions use service role)
CREATE POLICY "Service role can upload news images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'news-images');

-- Allow service role to update images
CREATE POLICY "Service role can update news images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'news-images');

-- Allow service role to delete images
CREATE POLICY "Service role can delete news images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'news-images');