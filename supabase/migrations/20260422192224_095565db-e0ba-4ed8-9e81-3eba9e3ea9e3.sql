-- Tabella per gli snapshot Pulse settimanale generati dall'AI
CREATE TABLE public.user_pulse_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  narrative text NOT NULL,
  trajectory_label text NOT NULL,
  focus_phrase text NOT NULL,
  streak_days integer NOT NULL DEFAULT 0,
  count_week integer NOT NULL DEFAULT 0,
  comprehensions_analyzed jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- Indice per "ultima pulse di X"
CREATE INDEX idx_user_pulse_snapshots_user_generated
  ON public.user_pulse_snapshots (user_id, generated_at DESC);

-- RLS
ALTER TABLE public.user_pulse_snapshots ENABLE ROW LEVEL SECURITY;

-- SELECT: solo le proprie pulse
CREATE POLICY "Users can read their own pulse snapshots"
  ON public.user_pulse_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: nessun client può inserire (solo service role bypassa RLS)
CREATE POLICY "No client inserts on pulse snapshots"
  ON public.user_pulse_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Nessuna policy per UPDATE/DELETE: negate di default per tutti tranne service role.