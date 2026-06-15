-- ============================================================
-- Step 2.2.b: link preview image metadata columns
-- Aggiunge dimensioni, ratio classificato, orientation, ambient_url
-- a posts.preview_img_* e content_cache.meta_image_*
-- ============================================================

-- 1. posts.preview_img_* — il post linka a un URL share + immagine OG
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS preview_img_width INTEGER,
  ADD COLUMN IF NOT EXISTS preview_img_height INTEGER,
  ADD COLUMN IF NOT EXISTS preview_img_ratio TEXT,
  ADD COLUMN IF NOT EXISTS preview_img_orientation TEXT,
  ADD COLUMN IF NOT EXISTS preview_img_ambient_url TEXT;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_preview_img_ratio_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_preview_img_ratio_check
  CHECK (preview_img_ratio IS NULL OR preview_img_ratio IN ('9:16', '3:4', '1:1', '4:3', '3:2', '16:9'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_preview_img_orientation_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_preview_img_orientation_check
  CHECK (preview_img_orientation IS NULL OR preview_img_orientation IN ('portrait', 'landscape', 'square'));

-- 2. content_cache.meta_image_* — cache scraping di OG per URL share
ALTER TABLE public.content_cache
  ADD COLUMN IF NOT EXISTS meta_image_width INTEGER,
  ADD COLUMN IF NOT EXISTS meta_image_height INTEGER,
  ADD COLUMN IF NOT EXISTS meta_image_ratio TEXT,
  ADD COLUMN IF NOT EXISTS meta_image_orientation TEXT,
  ADD COLUMN IF NOT EXISTS meta_image_ambient_url TEXT;

ALTER TABLE public.content_cache
  DROP CONSTRAINT IF EXISTS content_cache_meta_image_ratio_check;
ALTER TABLE public.content_cache
  ADD CONSTRAINT content_cache_meta_image_ratio_check
  CHECK (meta_image_ratio IS NULL OR meta_image_ratio IN ('9:16', '3:4', '1:1', '4:3', '3:2', '16:9'));

ALTER TABLE public.content_cache
  DROP CONSTRAINT IF EXISTS content_cache_meta_image_orientation_check;
ALTER TABLE public.content_cache
  ADD CONSTRAINT content_cache_meta_image_orientation_check
  CHECK (meta_image_orientation IS NULL OR meta_image_orientation IN ('portrait', 'landscape', 'square'));

-- 3. Comment esplicativi
COMMENT ON COLUMN public.posts.preview_img_width IS 'Width in pixels of preview_img. Populated by publish-post from content_cache (step 2.2.b).';
COMMENT ON COLUMN public.posts.preview_img_height IS 'Height in pixels of preview_img.';
COMMENT ON COLUMN public.posts.preview_img_ratio IS 'Classified ratio (9:16, 3:4, 1:1, 4:3, 3:2, 16:9). Used by MediaFrame matrix §5.1.';
COMMENT ON COLUMN public.posts.preview_img_orientation IS 'Derived from preview_img_ratio. portrait/square/landscape.';
COMMENT ON COLUMN public.posts.preview_img_ambient_url IS 'Downscaled (200px width) for AmbientLayer §S2 background.';

COMMENT ON COLUMN public.content_cache.meta_image_width IS 'Width in pixels of OG meta_image_url. Measured server-side via Range request (step 2.2.b).';
COMMENT ON COLUMN public.content_cache.meta_image_height IS 'Height in pixels of meta_image_url.';
COMMENT ON COLUMN public.content_cache.meta_image_ratio IS 'Classified ratio. Source of truth for posts.preview_img_ratio after publish-post propagation.';
COMMENT ON COLUMN public.content_cache.meta_image_orientation IS 'Derived from meta_image_ratio.';
COMMENT ON COLUMN public.content_cache.meta_image_ambient_url IS 'Downscaled version for ambient background.';