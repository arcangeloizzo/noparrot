CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id,
    created_at,
    username,
    full_name,
    avatar_url,
    bio,
    is_ai_institutional
   FROM profiles
  WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;