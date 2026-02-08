-- Add image_url column to daily_focus table
ALTER TABLE public.daily_focus 
ADD COLUMN image_url TEXT;

-- Add image_url column to interest_focus table
ALTER TABLE public.interest_focus 
ADD COLUMN image_url TEXT;