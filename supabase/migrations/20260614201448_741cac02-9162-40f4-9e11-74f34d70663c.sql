UPDATE public.media
SET
  ratio = CASE
    WHEN width::float / height::float >= 1.39    THEN '16:9'
    WHEN width::float / height::float >= 0.875   THEN '1:1'
    WHEN width::float / height::float >= 0.65625 THEN '3:4'
    ELSE                                              '9:16'
  END,
  orientation = CASE
    WHEN width::float / height::float >= 1.39  THEN 'landscape'
    WHEN width::float / height::float >= 0.875 THEN 'square'
    ELSE                                            'portrait'
  END,
  ambient_url = CASE
    WHEN url LIKE '%/storage/v1/object/public/%' AND url LIKE '%?%'
      THEN url || '&width=200&quality=40'
    WHEN url LIKE '%/storage/v1/object/public/%'
      THEN url || '?width=200&quality=40'
    ELSE url
  END
WHERE ratio IS NULL
  AND width IS NOT NULL
  AND height IS NOT NULL
  AND width > 0
  AND height > 0;

DO $$
DECLARE
  remaining_null integer;
BEGIN
  SELECT COUNT(*) INTO remaining_null
  FROM public.media
  WHERE ratio IS NULL;
  RAISE NOTICE 'Media rows still with NULL ratio after backfill: %', remaining_null;
END $$;