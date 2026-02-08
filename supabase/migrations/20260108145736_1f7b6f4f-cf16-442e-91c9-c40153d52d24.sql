-- Add expires_at column to post_gate_attempts for GDPR data retention compliance
ALTER TABLE public.post_gate_attempts 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '365 days');

-- Update existing records to have expiration date
UPDATE public.post_gate_attempts 
SET expires_at = created_at + interval '365 days'
WHERE expires_at IS NULL;