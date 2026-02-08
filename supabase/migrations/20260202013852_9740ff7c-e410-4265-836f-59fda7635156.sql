-- Estendi constraint per focus_reactions (accetta tutte le emoji)
ALTER TABLE public.focus_reactions 
  DROP CONSTRAINT IF EXISTS focus_reactions_reaction_type_check;

ALTER TABLE public.focus_reactions 
  ADD CONSTRAINT focus_reactions_reaction_type_check 
  CHECK (reaction_type IN ('heart', 'bookmark', 'laugh', 'wow', 'sad', 'fire'));

-- Estendi constraint per reactions (posts)
ALTER TABLE public.reactions 
  DROP CONSTRAINT IF EXISTS reactions_reaction_type_check;

ALTER TABLE public.reactions 
  ADD CONSTRAINT reactions_reaction_type_check 
  CHECK (reaction_type IN ('heart', 'bookmark', 'laugh', 'wow', 'sad', 'fire'));