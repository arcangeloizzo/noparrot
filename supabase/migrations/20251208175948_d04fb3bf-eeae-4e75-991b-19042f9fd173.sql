-- Aggiungere colonna last_seen_at per tracciare l'ultima attività
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Funzione per aggiornare last_seen_at
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen_at = now() 
  WHERE id = auth.uid();
END;
$$;