-- Wrapper con refresh on-demand
CREATE OR REPLACE FUNCTION public.get_user_cognitive_density_fresh(p_user_id uuid)
RETURNS TABLE(macro_category text, density numeric, action_breakdown jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh della materialized view (CONCURRENTLY: senza lock di lettura)
  PERFORM public.refresh_user_cognitive_density();
  
  RETURN QUERY 
  SELECT 
    ucd.macro_category,
    ucd.density,
    ucd.action_breakdown
  FROM public.user_cognitive_density ucd
  JOIN public.profiles pr ON pr.id = ucd.user_id
  WHERE ucd.user_id = p_user_id
    AND COALESCE(pr.cognitive_tracking_enabled, true) = true
  ORDER BY ucd.density DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cognitive_density_fresh(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_cognitive_density_fresh IS 'Variante con refresh on-demand. Usare per profilo proprio. Per profili altrui usare get_user_cognitive_density (no refresh).';

-- Marca legacy la colonna profiles.cognitive_density
COMMENT ON COLUMN public.profiles.cognitive_density IS 'LEGACY (Phase 4.4): contatore JSONB sostituito dalla vista user_cognitive_density. Mantenuto come backup. NON leggere/scrivere. Da droppare in Phase 4.5+ dopo 30 giorni di stabilità.';