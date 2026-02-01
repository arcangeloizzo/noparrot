-- Fix: Restrict user_roles to authenticated users only
-- Prevents unauthenticated enumeration of admin/moderator users

-- 1. Drop the overly permissive public policy
DROP POLICY IF EXISTS "User roles viewable by everyone" ON public.user_roles;

-- 2. Create new policy: Only authenticated users can view roles
CREATE POLICY "Authenticated users can view roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Admin management policy using existing has_role() function (avoids infinite recursion)
CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));