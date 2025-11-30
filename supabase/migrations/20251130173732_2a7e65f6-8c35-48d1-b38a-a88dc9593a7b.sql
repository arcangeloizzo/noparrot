-- Tabella per Daily Focus (notizia globale del giorno)
CREATE TABLE IF NOT EXISTS public.daily_focus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  sources JSONB NOT NULL,
  trust_score TEXT DEFAULT 'Medio',
  category TEXT,
  reactions JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- Tabella per Interest Focus (notizie personalizzate per categoria)
CREATE TABLE IF NOT EXISTS public.interest_focus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  sources JSONB NOT NULL,
  trust_score TEXT DEFAULT 'Medio',
  reactions JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '12 hours')
);

-- Tabella per reazioni ai Focus (like/bookmark)
CREATE TABLE IF NOT EXISTS public.focus_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_id UUID NOT NULL,
  focus_type TEXT NOT NULL CHECK (focus_type IN ('daily', 'interest')),
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'bookmark')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, focus_id, reaction_type)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_daily_focus_expires ON public.daily_focus(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_interest_focus_category ON public.interest_focus(category, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_reactions_user ON public.focus_reactions(user_id, focus_type);

-- RLS Policies
ALTER TABLE public.daily_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_reactions ENABLE ROW LEVEL SECURITY;

-- Daily Focus: tutti possono leggere
CREATE POLICY "Daily focus viewable by everyone"
  ON public.daily_focus FOR SELECT
  USING (true);

-- Daily Focus: solo edge functions possono inserire/aggiornare
CREATE POLICY "Service role can manage daily focus"
  ON public.daily_focus FOR ALL
  USING (true);

-- Interest Focus: tutti possono leggere
CREATE POLICY "Interest focus viewable by everyone"
  ON public.interest_focus FOR SELECT
  USING (true);

-- Interest Focus: solo edge functions possono inserire/aggiornare
CREATE POLICY "Service role can manage interest focus"
  ON public.interest_focus FOR ALL
  USING (true);

-- Focus Reactions: utenti possono vedere tutte le reazioni
CREATE POLICY "Focus reactions viewable by everyone"
  ON public.focus_reactions FOR SELECT
  USING (true);

-- Focus Reactions: utenti possono gestire solo le proprie
CREATE POLICY "Users can manage own focus reactions"
  ON public.focus_reactions FOR ALL
  USING (auth.uid() = user_id);