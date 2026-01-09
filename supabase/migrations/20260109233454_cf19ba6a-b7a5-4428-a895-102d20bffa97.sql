-- Create AI usage logs table for telemetry
CREATE TABLE ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model text NOT NULL,
  input_chars integer NOT NULL,
  output_chars integer NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  latency_ms integer NOT NULL,
  provider_latency_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_code text,
  user_hash text,
  source_domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ai_usage_logs_function ON ai_usage_logs(function_name);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_user ON ai_usage_logs(user_hash) WHERE user_hash IS NOT NULL;
CREATE INDEX idx_ai_usage_logs_model ON ai_usage_logs(model);

-- Enable RLS (only service_role can access)
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- No public policies - only service_role can insert/read