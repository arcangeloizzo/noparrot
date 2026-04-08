ALTER TABLE public.comments DROP CONSTRAINT content_length;
ALTER TABLE public.comments ADD CONSTRAINT content_length CHECK ((length(content) > 0) AND (length(content) <= 1500));