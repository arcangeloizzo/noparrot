CREATE POLICY "Users can update own subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);