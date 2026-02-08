-- Fix per commenti post
ALTER TABLE public.comment_reactions
  DROP CONSTRAINT IF EXISTS comment_reactions_reaction_type_check;
ALTER TABLE public.comment_reactions
  ADD CONSTRAINT comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('heart', 'laugh', 'wow', 'sad', 'fire'));

-- Fix per commenti editoriali (Il Punto)
ALTER TABLE public.focus_comment_reactions
  DROP CONSTRAINT IF EXISTS focus_comment_reactions_reaction_type_check;
ALTER TABLE public.focus_comment_reactions
  ADD CONSTRAINT focus_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('heart', 'laugh', 'wow', 'sad', 'fire'));

-- Fix per commenti media
ALTER TABLE public.media_comment_reactions
  DROP CONSTRAINT IF EXISTS media_comment_reactions_reaction_type_check;
ALTER TABLE public.media_comment_reactions
  ADD CONSTRAINT media_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('heart', 'laugh', 'wow', 'sad', 'fire'));