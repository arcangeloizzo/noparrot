-- 1. Create security definer function to check thread participation
CREATE OR REPLACE FUNCTION public.user_is_thread_participant(check_thread_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM thread_participants 
    WHERE thread_id = check_thread_id 
    AND user_id = check_user_id
  );
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Users can view participants of their threads" ON thread_participants;

-- 3. Create new policy using the security definer function
CREATE POLICY "Users can view their thread participants"
ON thread_participants
FOR SELECT
TO authenticated
USING (
  public.user_is_thread_participant(thread_id, auth.uid())
);