-- Extend ratio CHECK constraint to include 4:3 and 3:2 landscape
-- Backfill existing media records with new nearest-neighbor logic

ALTER TABLE public.media
  DROP CONSTRAINT IF EXISTS media_ratio_check;

ALTER TABLE public.media
  ADD CONSTRAINT media_ratio_check
  CHECK (ratio IS NULL OR ratio IN ('9:16', '3:4', '1:1', '4:3', '3:2', '16:9'));

ALTER TABLE public.daily_focus
  DROP CONSTRAINT IF EXISTS daily_focus_image_ratio_check;

ALTER TABLE public.daily_focus
  ADD CONSTRAINT daily_focus_image_ratio_check
  CHECK (image_ratio IS NULL OR image_ratio IN ('9:16', '3:4', '1:1', '4:3', '3:2', '16:9'));

UPDATE public.media
SET
  ratio = CASE
    WHEN (width::float / height::float) < 0.65625 THEN '9:16'
    WHEN (width::float / height::float) < 0.875   THEN '3:4'
    WHEN (width::float / height::float) < 1.1666  THEN '1:1'
    WHEN (width::float / height::float) < 1.4166  THEN '4:3'
    WHEN (width::float / height::float) < 1.6388  THEN '3:2'
    ELSE '16:9'
  END,
  orientation = CASE
    WHEN (width::float / height::float) < 0.875  THEN 'portrait'
    WHEN (width::float / height::float) < 1.1666 THEN 'square'
    ELSE 'landscape'
  END
WHERE width IS NOT NULL
  AND height IS NOT NULL
  AND width > 0
  AND height > 0;

UPDATE public.daily_focus
SET
  image_ratio = CASE
    WHEN (image_width::float / image_height::float) < 0.65625 THEN '9:16'
    WHEN (image_width::float / image_height::float) < 0.875   THEN '3:4'
    WHEN (image_width::float / image_height::float) < 1.1666  THEN '1:1'
    WHEN (image_width::float / image_height::float) < 1.4166  THEN '4:3'
    WHEN (image_width::float / image_height::float) < 1.6388  THEN '3:2'
    ELSE '16:9'
  END,
  image_orientation = CASE
    WHEN (image_width::float / image_height::float) < 0.875  THEN 'portrait'
    WHEN (image_width::float / image_height::float) < 1.1666 THEN 'square'
    ELSE 'landscape'
  END
WHERE image_width IS NOT NULL
  AND image_height IS NOT NULL
  AND image_width > 0
  AND image_height > 0;

COMMENT ON CONSTRAINT media_ratio_check ON public.media IS
  'Allowed ratios: 9:16 and 3:4 (portrait), 1:1 (square), 4:3, 3:2 and 16:9 (landscape). Spec v1.1 §M1.';