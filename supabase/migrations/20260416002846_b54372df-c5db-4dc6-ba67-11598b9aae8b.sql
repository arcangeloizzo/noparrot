-- Fix all Vinile slots to 20:00 CEST (hour=20 in CET matching)
UPDATE public.ai_posting_schedule 
SET hour = 20, minute = 0 
WHERE profile_id = (SELECT id FROM public.ai_profiles WHERE handle = 'vinile');