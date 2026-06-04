-- Migration: Add 'instagram_reel' to post_type_enum
ALTER TYPE public.post_type_enum ADD VALUE IF NOT EXISTS 'instagram_reel';
