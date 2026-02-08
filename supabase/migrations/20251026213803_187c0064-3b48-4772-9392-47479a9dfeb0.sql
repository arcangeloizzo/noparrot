-- Fix RLS policy for message_threads to ensure users can create threads
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can create message threads" ON message_threads;

-- Create new policy that allows authenticated users to insert threads
CREATE POLICY "Authenticated users can create threads"
ON message_threads
FOR INSERT
TO authenticated
WITH CHECK (true);