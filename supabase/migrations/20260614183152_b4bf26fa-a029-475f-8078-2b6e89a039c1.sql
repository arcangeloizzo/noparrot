-- Unified Media Foundation — spec v1.1 §M2 §M4
ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS ratio text
    CHECK (ratio IS NULL OR ratio IN ('9:16','3:4','1:1','16:9')),
  ADD COLUMN IF NOT EXISTS orientation text
    CHECK (orientation IS NULL OR orientation IN ('portrait','landscape','square')),
  ADD COLUMN IF NOT EXISTS ambient_url text;

COMMENT ON COLUMN public.media.ratio IS
  'Clamped aspect ratio (spec v1.1 §M2). Null = legacy row, derive at read.';
COMMENT ON COLUMN public.media.orientation IS
  'Derived from ratio: 9:16/3:4 → portrait; 1:1 → square; 16:9 → landscape.';
COMMENT ON COLUMN public.media.ambient_url IS
  'Small downscale (~150-300px wide) for AmbientLayer §S2 blur. May equal url if source small.';

ALTER TABLE public.daily_focus
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer,
  ADD COLUMN IF NOT EXISTS image_ratio text
    CHECK (image_ratio IS NULL OR image_ratio IN ('9:16','3:4','1:1','16:9')),
  ADD COLUMN IF NOT EXISTS image_orientation text
    CHECK (image_orientation IS NULL OR image_orientation IN ('portrait','landscape','square')),
  ADD COLUMN IF NOT EXISTS image_ambient_url text;