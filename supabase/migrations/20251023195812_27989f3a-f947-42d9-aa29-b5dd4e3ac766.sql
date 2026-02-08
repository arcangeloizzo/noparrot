-- Funzione per calcolare il level automaticamente
CREATE OR REPLACE FUNCTION public.set_comment_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
  ELSE
    SELECT COALESCE(level, 0) + 1 INTO NEW.level
    FROM public.comments
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger che esegue la funzione prima di ogni insert
CREATE TRIGGER trigger_set_comment_level
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.set_comment_level();

-- Aggiorna i commenti esistenti per correggere i loro livelli
WITH RECURSIVE comment_tree AS (
  -- Commenti di primo livello
  SELECT id, parent_id, 0 AS correct_level
  FROM public.comments
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Commenti nested
  SELECT c.id, c.parent_id, ct.correct_level + 1
  FROM public.comments c
  INNER JOIN comment_tree ct ON c.parent_id = ct.id
)
UPDATE public.comments
SET level = comment_tree.correct_level
FROM comment_tree
WHERE comments.id = comment_tree.id;