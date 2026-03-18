-- Create export_logs table
CREATE TABLE IF NOT EXISTS public.export_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can view their own export logs" 
    ON public.export_logs FOR SELECT 
    USING (auth.uid() = user_id);

-- Only service role can insert (handled by edge function)
-- Alternatively, if we wanted users to insert directly, we could add a policy, 
-- but doing it via Edge Function is safer to strictly enforce the export mechanism.
