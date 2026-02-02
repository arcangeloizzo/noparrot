-- 1. Forza l'attivazione delle RLS
ALTER TABLE public.focus_comments ENABLE ROW LEVEL SECURITY;

-- 2. Rimuovi la vecchia policy troppo permissiva
DROP POLICY IF EXISTS "Focus comments viewable by everyone" ON public.focus_comments;

-- 3. Nuova Policy SELECT: Solo utenti autenticati possono leggere i commenti
-- Questo impedisce a bot e utenti non loggati di fare profiling
CREATE POLICY "Authenticated users can view focus comments" 
ON public.focus_comments 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Assicura che la policy di inserimento rimanga corretta per gli autori
DROP POLICY IF EXISTS "Users can insert own focus comments" ON public.focus_comments;
DROP POLICY IF EXISTS "Users can delete own focus comments" ON public.focus_comments;

CREATE POLICY "Authors can manage own focus comments" 
ON public.focus_comments 
FOR ALL 
TO authenticated 
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);