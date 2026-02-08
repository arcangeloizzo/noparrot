-- Add popularity column to content_cache for Spotify PULSE badge
ALTER TABLE public.content_cache ADD COLUMN popularity integer;