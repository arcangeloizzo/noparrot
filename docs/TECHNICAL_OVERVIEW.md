# Documentazione Tecnica - NoParrot

## 1. Overview del Progetto
**NoParrot** è una piattaforma di "Information Diet" progettata per combattere il sovraccarico cognitivo e la disinformazione. Utilizza l'intelligenza artificiale per filtrare, sintetizzare e validare le notizie, offrendo un'esperienza di consumo consapevole.

## 2. Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + `shadcn/ui` (Radix UI)
- **Animations**: Framer Motion
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM

### Backend & Infrastructure (Supabase)
- **Database**: PostgreSQL
- **Auth**: Supabase Auth (Email, Social Providers)
- **Storage**: Supabase Storage (User media, infographics)
- **Serverless Logic**: Deno Edge Functions
- **Realtime**: Supabase Realtime (Channels)

## 3. Architettura AI & Edge Functions
Il cuore pulsante di NoParrot risiede nelle sue Edge Functions, che orchestrano diversi servizi AI tramite il gateway **Lovable**.

### Provider AI Principale
- **Gateway**: `ai.gateway.lovable.dev`
- **Modelli**:
  - `google/gemini-2.5-flash-lite`: Task veloci (Classificazione, Trust Score, Quiz).
  - `google/gemini-2.5-flash`: Sintesi complesse, Analisi profonda.
  - `google/imagen-3`: Generazione Immagini (Infografiche).

### Servizi Esterni Integrati
- **Jina AI (`r.jina.ai`)**: Scraping e pulizia contenuti web per la generazione Q&A.
- **Firecrawl**: Scraping "stealth" di backup per siti protetti.
- **Supadata.ai**: Trascrizione video YouTube (fallback per `youtube-transcript`).

### Funzioni Chiave

#### A. Trust Score (`evaluate-trust-score`)
Analizza l'affidabilità di una fonte URL.
- **Logica**:
  1. **Whitelist**: Controllo immediato su domini "Trusted" (es. ansa.it, bbc.com) per risparmiare token.
  2. **Cache**: Validità 7 giorni su DB (`trust_scores`).
  3. **AI Analysis**: Se non in whitelist/cache, interroga Gemini Flash Lite valutando dominio e contesto.

#### B. Daily Focus (`fetch-daily-focus`)
Il motore di aggregazione notizie.
- **Sorgente**: Google News RSS.
- **Deduplicazione**:
  - *Hard*: Impronta digitale titolo+data.
  - *Soft*: Similarità semantica (Gemini Flash Lite) per raggruppare notizie sullo stesso evento.
- **Sintesi**: Genera un riassunto olistico ("Il Punto") usando Gemini Flash, fondendo fino a 8 fonti diverse senza citarle singolarmente.

#### C. Infographic Generator (`generate-infographic`)
Crea poster visivi da testi utente o notizie.
- **Engine**: Google Imagen 3.
- **Post-Processing**: Watermarking via `imagescript` (Deno) per applicare logo e branding.

#### D. Q&A & Learning (`generate-qa`)
Genera quiz interattivi da articoli o video.
- **Pipeline**:
  1. Estrazione contenuto (YouTube Transcript o Jina Reader).
  2. Generazione Domande (Gemini Flash Lite).
  3. Validazione anti-allucinazione ("Immune System" check su metadati).

## 4. Sicurezza & Dati
- **Row Level Security (RLS)**: Tutte le tabelle sensibili (`profiles`, `user_consents`) sono protette.
- **Privacy View**: `public_profiles` espone solo dati sicuri, bypassando RLS in modo controllato (`security_invoker = false`).
- **Telemetry**: Log di utilizzo AI anonimizzati (`ai_usage_logs`) per monitoraggio costi e performance.
