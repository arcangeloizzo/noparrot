-- Allow users to update their own media rows (needed to persist extracted_status/kind while polling)
DROP POLICY IF EXISTS "Users can update own media" ON public.media;
CREATE POLICY "Users can update own media"
ON public.media
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
