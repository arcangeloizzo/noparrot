CREATE OR REPLACE FUNCTION public.get_user_cognitive_density_fresh(p_user_id uuid)
RETURNS TABLE(macro_category text, density numeric, action_breakdown jsonb)
LANGUAGE plpgsql
VOLATILE
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