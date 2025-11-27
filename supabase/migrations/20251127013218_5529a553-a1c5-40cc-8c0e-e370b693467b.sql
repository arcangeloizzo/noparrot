-- Aggiungere campo category alla tabella posts
ALTER TABLE public.posts 
ADD COLUMN category TEXT;

-- Aggiungere campo cognitive_density alla tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN cognitive_density JSONB DEFAULT '{}'::jsonb;

-- Aggiungere campi preparatori alla tabella comments per future funzionalità
ALTER TABLE public.comments 
ADD COLUMN post_category TEXT,
ADD COLUMN user_density_before_comment JSONB;