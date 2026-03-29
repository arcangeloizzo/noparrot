UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['text/html', 'text/html; charset=utf-8']
WHERE id = 'share-previews';