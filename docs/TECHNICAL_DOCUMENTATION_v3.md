# NoParrot — Documentazione Tecnica Completa v3.0

**Versione:** 3.0  
**Data:** 12 febbraio 2026  
**Stato:** Produzione  
**URL Produzione:** https://noparrot.lovable.app

---

## Indice

1. [Mission e Purpose](#1-mission-e-purpose)
2. [Architettura Generale](#2-architettura-generale)
3. [I Quattro Pilastri](#3-i-quattro-pilastri)
4. [Stack Tecnologico](#4-stack-tecnologico)
5. [Database e Schema](#5-database-e-schema)
6. [Edge Functions (Backend)](#6-edge-functions-backend)
7. [Integrazioni AI](#7-integrazioni-ai)
8. [API e Servizi Esterni](#8-api-e-servizi-esterni)
9. [Autenticazione e Sicurezza](#9-autenticazione-e-sicurezza)
10. [Feature Implementate](#10-feature-implementate)
11. [Design System](#11-design-system)
12. [Privacy e Compliance GDPR](#12-privacy-e-compliance-gdpr)
13. [PWA e Push Notifications](#13-pwa-e-push-notifications)
14. [Performance e Ottimizzazioni](#14-performance-e-ottimizzazioni)

---

## 1. Mission e Purpose

### 1.1 La Visione

**NoParrot** è una piattaforma cognitiva che trasforma lo scrolling passivo in comprensione attiva. Il nome "No Parrot" significa "non ripetere come un pappagallo": prima di interagire con un contenuto, l'utente deve dimostrare di averlo compreso.

### 1.2 I Problemi che Risolve

- Consumo superficiale di informazioni (doomscrolling)
- Engagement tossico basato su reazioni impulsive
- Mancanza di strumenti per verificare le fonti
- Assenza di feedback sulla propria crescita intellettuale

### 1.3 Manifesto

> "Non basta informarsi. Bisogna comprendere."
>
> Ogni like ha un significato. Ogni commento richiede consapevolezza.
> Ogni condivisione è una scelta informata. La tua crescita intellettuale è visibile.

---

## 2. Architettura Generale

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18 + Vite)                │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Feed     │  │ Il Punto ◉   │  │ Profilo Cognitivo       │ │
│  │Immersivo │  │ (Editorial)  │  │ (Nebulosa + Diario)     │ │
│  └──────────┘  └──────────────┘  └─────────────────────────┘ │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Composer │  │  Messaggi    │  │  Cerca + Trending       │ │
│  │(Tiptap)  │  │  (Realtime)  │  │  Topics                 │ │
│  └──────────┘  └──────────────┘  └─────────────────────────┘ │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                 LOVABLE CLOUD (Supabase)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │PostgreSQL│  │   Auth   │  │  Storage  │  │ 17 Edge      │ │
│  │43 tabelle│  │  + RLS   │  │ 3 bucket  │  │ Functions    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    Realtime (WebSocket)                   ││
│  └──────────────────────────────────────────────────────────┘│
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVIZI ESTERNI                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │Lovable AI│  │Firecrawl │  │ Supadata │  │   Jina AI    │ │
│  │(Gateway) │  │(Scraping)│  │(YouTube) │  │ (Fallback)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Spotify  │  │  Genius  │  │ Deepgram │                   │
│  │  (API)   │  │ (Lyrics) │  │ (Audio)  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. I Quattro Pilastri

### 3.1 🔒 Comprehension Gate

Quiz AI generati dal contenuto (articolo/video/testo). L'utente deve superare il test (≥60%) prima di commentare o reagire. Architettura **zero-knowledge**: le risposte corrette non sono MAI esposte al client.

| Componente | Descrizione |
|-----------|-------------|
| `post_qa_questions` | Domande visibili (RLS: owner_id) |
| `post_qa_answers` | Risposte corrette (RLS: service_role ONLY) |
| `post_gate_attempts` | Tentativi utente (scadenza 365gg) |
| `generate-qa` | Edge Function generazione quiz |
| `submit-qa` | Edge Function validazione (rate limit: 10/5min) |

**Modalità:** `soft` | `guardrail` (default) | `strict`

### 3.2 🛡️ Trust Score

Valutazione AI dell'affidabilità della **fonte** (non del contenuto). Cache 7 giorni. Whitelist "Lazy Trust" per 25+ domini istituzionali (ansa.it, bbc.com, reuters.com...) che skippa la chiamata AI.

**Fasce:** Basso | Medio | Alto

### 3.3 ◉ Il Punto (Sintesi Editoriale AI)

Feed editoriale con sintesi multi-fonte generate da AI. **Non è giornalismo** — è aggregazione algoritmica con trasparenza totale sulle fonti.

| Tipo | Tabella | Descrizione |
|------|---------|-------------|
| Daily Focus | `daily_focus` | Notizie del giorno aggregate |
| Interest Focus | `interest_focus` | Per categoria di interesse |

**Badge:** "✨ AI SYNTHESIS" + timestamp completo. Disclaimer legale integrato.

### 3.4 🌌 Identità Cognitiva (Nebulosa)

Visualizzazione della mappa mentale dell'utente basata sulle interazioni verificate (post-gate). 6 macro-categorie: Società, Economia, Tecnologia, Cultura, Politica, Scienza.

**Privacy:** Opt-in esplicito, dati visibili solo al proprietario, revocabile.

---

## 4. Stack Tecnologico

### 4.1 Frontend

| Tecnologia | Versione | Uso |
|-----------|---------|-----|
| React | 18.3+ | UI Framework |
| Vite | 5.x | Build tool + HMR |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling (design tokens HSL) |
| shadcn/ui | Latest | Component library base |
| TanStack Query | 5.x | Data fetching, caching, infinite scroll |
| React Router | 6.x | Client-side routing |
| Framer Motion | 12.x | Animazioni e gesture |
| Tiptap | 3.x | Rich text editor (Composer) |
| react-zoom-pan-pinch | 3.x | Media viewer zoom |
| Recharts | 2.x | Grafici (profilo cognitivo) |
| react-palette | 1.x | Estrazione colori dominanti |

### 4.2 Backend (Lovable Cloud / Supabase)

| Servizio | Dettaglio |
|---------|-----------|
| Database | PostgreSQL con 43 tabelle |
| Auth | Email + password, age gate (16+) |
| RLS | Row Level Security su tutte le tabelle |
| Edge Functions | 17 funzioni Deno |
| Storage | 3 bucket (avatars, user-media, news-images) |
| Realtime | WebSocket per messaggi |
| DB Functions | 20+ funzioni SQL (trigger, RPC) |

### 4.3 Secrets Configurati

| Secret | Servizio |
|--------|----------|
| `LOVABLE_API_KEY` | Lovable AI Gateway |
| `FIRECRAWL_API_KEY` | Firecrawl (connector) |
| `SUPADATA_API_KEY` | Supadata (YouTube) |
| `JINA_API_KEY` | Jina AI (fallback scraping) |
| `OPENAI_API_KEY` | OpenAI (legacy/fallback) |
| `PERPLEXITY_API_KEY` | Perplexity (ricerca) |
| `YOUTUBE_API_KEY` | YouTube Data API |
| `SPOTIFY_CLIENT_ID/SECRET` | Spotify API |
| `GENIUS_API_KEY` | Genius (lyrics) |
| `DEEPGRAM_API_KEY` | Deepgram (audio) |
| `VAPID_PRIVATE_KEY/SUBJECT` | Web Push |
| `AI_TELEMETRY_HMAC_SECRET` | Pseudonimizzazione telemetria |

---

## 5. Database e Schema

### 5.1 Statistiche Attuali (Feb 2026)

| Metrica | Valore |
|---------|--------|
| Tabelle totali | 43 |
| Dimensione totale DB | ~18 MB |
| Tabella più grande | `ai_usage_logs` (10 MB, 46.438 righe) |
| Utenti registrati | ~10 profili |
| Post pubblicati | 162 |
| Commenti | 88 |
| Tentativi Gate | 331 |
| Trust Score calcolati | 157 |
| Focus editoriali (daily) | 142 |
| Focus editoriali (interest) | 184 |

### 5.2 Tabelle Principali

**Utenti:** `profiles`, `public_profiles` (view), `user_consents`, `user_roles`

**Contenuti:** `posts`, `comments`, `reactions`, `comment_reactions`, `post_media`, `comment_media`, `media`

**Gate:** `post_qa_questions`, `post_qa_answers`, `post_gate_attempts`, `qa_submit_attempts`

**Editoriale:** `daily_focus`, `interest_focus`, `focus_comments`, `focus_reactions`, `focus_comment_reactions`, `focus_bookmarks`

**Messaggi:** `message_threads`, `thread_participants`, `messages`, `message_reactions`, `message_media`, `message_deletions`

**Cache:** `content_cache`, `youtube_transcripts_cache`, `trust_scores`, `trending_topics_cache`

**Sistema:** `ai_usage_logs`, `push_subscriptions`, `publish_idempotency`, `post_topics`, `notifications`, `export_requests`

### 5.3 View

```sql
public_profiles -- Esclude PII (date_of_birth, cognitive_density, notification settings)
```

### 5.4 Funzioni Database Principali

- `create_or_get_thread()` — Crea/recupera thread messaggi
- `user_is_thread_participant()` — Verifica partecipazione
- `user_can_react_to_message()` — Verifica permesso reazione
- `extract_mentions()` — Parsing @menzioni
- `get_share_counts()` — Conteggio condivisioni per URL
- `handle_new_user()` — Trigger creazione profilo
- `create_mention_notifications()` — Trigger notifiche menzioni
- `notify_new_reaction()` / `notify_comment_reaction()` — Trigger notifiche
- `increment_shares_on_reshare()` — Trigger contatore reshare
- `set_comment_level()` / `set_focus_comment_level()` — Trigger livello nesting
- `trigger_push_notification()` / `trigger_push_message()` — Trigger push
- `notify_admins_new_user()` — Notifica admin nuovi utenti

---

## 6. Edge Functions (Backend)

### 6.1 Mappa Completa

| Funzione | JWT | Modello AI | Descrizione |
|----------|-----|-----------|-------------|
| `publish-post` | ❌ | — | Pipeline creazione post (idempotent) |
| `generate-qa` | ❌ | Gemini 2.5 Flash | Generazione quiz comprensione |
| `get-qa` | ❌ | — | Fetch domande quiz |
| `submit-qa` | ❌ | — | Validazione risposte (zero-knowledge) |
| `validate-answers` | ❌ | — | Legacy endpoint validazione |
| `fetch-article-preview` | ✅ | — | Estrazione contenuto articoli web |
| `transcribe-youtube` | ❌ | — | Trascrizione video YouTube |
| `classify-content` | ✅ | Gemini 2.5 Flash | Classificazione categoria contenuto |
| `evaluate-trust-score` | ✅ | Gemini 2.5 Flash | Calcolo Trust Score fonte |
| `get-trust-score` | ❌ | — | Fetch Trust Score cachato |
| `fetch-daily-focus` | ❌ | Gemini 2.5 Flash | Generazione "Il Punto" daily |
| `fetch-interest-focus` | ❌ | Gemini 2.5 Flash | Generazione focus per categoria |
| `generate-infographic` | ❌* | Gemini 2.5 Flash Image | Generazione infografica AI |
| `generate-trending-summary` | ❌ | Gemini 2.5 Flash | Sommario trending topics |
| `get-trending-topics` | ❌ | Gemini 2.5 Flash | Clustering trending topics |
| `assign-post-topic` | ❌ | Gemini 2.5 Flash | Assegnazione topic a post |
| `send-push-notification` | ❌ | — | Invio push notification |
| `generate-vapid-keys` | ❌ | — | Generazione chiavi VAPID |
| `export-user-data` | ❌ | — | Export dati utente (GDPR) |
| `cleanup-expired-cache` | ❌ | — | Pulizia cache scaduta |
| `extract-media-text` | ❌ | — | OCR/estrazione testo da media |
| `seed-data` | ❌ | — | Seed dati di test |
| `test-supadata` | ❌ | — | Test connessione Supadata |
| `fetch-lyrics` | ✅ | — | Fetch lyrics brani |

\* `generate-infographic`: JWT validato nel codice via `getClaims()`, non nel gateway

### 6.2 Pipeline publish-post

```
Client → publish-post → Idempotency check
                      → Crea post in DB
                      → fetch-article-preview (se URL)
                      → transcribe-youtube (se video YT)
                      → classify-content (categoria AI)
                      → generate-qa (quiz AI)
                      → assign-post-topic (topic clustering)
                      → Ritorna post_id
```

---

## 7. Integrazioni AI

### 7.1 Lovable AI Gateway

**Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`  
**Autenticazione:** Bearer `LOVABLE_API_KEY` (auto-provisioned)

| Modello | Uso in NoParrot |
|---------|----------------|
| `google/gemini-2.5-flash` | Quiz generation, classificazione, Trust Score, trending, editoriale |
| `google/gemini-2.5-flash-image` | Generazione infografiche (NanoBanana) |

### 7.2 Chiamate AI per Funzionalità

| Funzionalità | Modello | Input medio | Frequenza |
|-------------|---------|-------------|-----------|
| Quiz (generate-qa) | Gemini Flash | ~2000 chars | Ogni post con URL |
| Trust Score | Gemini Flash | ~500 chars | Ogni nuova fonte (cache 7gg) |
| Classificazione | Gemini Flash | ~1000 chars | Ogni post |
| Daily Focus | Gemini Flash | ~3000 chars | ~4-6x/giorno |
| Interest Focus | Gemini Flash | ~3000 chars | ~10-15x/giorno |
| Trending Topics | Gemini Flash | ~2000 chars | ~2x/giorno |
| Infografica | Gemini Flash Image | ~5000 chars | On-demand utente |

### 7.3 Ottimizzazioni AI

- **Lazy Trust whitelist:** 25+ domini istituzionali skippano la chiamata AI → -30/40% costi Trust Score
- **Content hash caching:** Quiz non rigenerati per stesso contenuto
- **Negative caching:** Estrazioni fallite cachate 30min (evita retry costosi)
- **Telemetria:** `ai_usage_logs` con pseudonimizzazione HMAC-SHA256 per monitoraggio costi/performance

### 7.4 Telemetria AI

Tabella `ai_usage_logs` (46.438 righe):
- `function_name`, `model`, `input_chars`, `output_chars`
- `latency_ms`, `provider_latency_ms`
- `cache_hit`, `success`, `error_code`
- `user_hash` (HMAC pseudonimizzato)
- `source_domain`

---

## 8. API e Servizi Esterni

| Servizio | API Key | Uso | Tipo Integrazione |
|---------|---------|-----|-------------------|
| **Firecrawl** | `FIRECRAWL_API_KEY` | Scraping articoli web | Connector Lovable |
| **Supadata** | `SUPADATA_API_KEY` | Trascrizione YouTube | Diretto |
| **Jina AI** | `JINA_API_KEY` | Fallback estrazione contenuto | Diretto |
| **Spotify** | `CLIENT_ID/SECRET` | Metadata brani, colori album | OAuth |
| **Genius** | `GENIUS_API_KEY` | Testi canzoni | Diretto |
| **Deepgram** | `DEEPGRAM_API_KEY` | Trascrizione audio | Diretto |
| **YouTube** | `YOUTUBE_API_KEY` | Metadata video | Diretto |
| **Web Push** | `VAPID_*` | Push notifications | Standard W3C |

---

## 9. Autenticazione e Sicurezza

### 9.1 Flusso Auth

```
Signup (email + DOB) → Age Gate (16+) → Email Confirmation
→ Onboarding Slides → Consent Screen → Feed
```

### 9.2 RLS (Row Level Security)

**Tutte le 43 tabelle** hanno RLS abilitato.

| Livello | Tabelle |
|---------|---------|
| Owner only | `profiles`, `user_consents`, `export_requests`, `post_qa_questions` |
| Authenticated | `posts`, `comments`, `reactions`, `followers`, `media`, `focus_comments` |
| Participants | `messages`, `thread_participants`, `message_reactions` |
| Service role only | `post_qa_answers`, `trust_scores`, `ai_usage_logs`, `push_subscriptions`, `trending_topics_cache` |
| Admin only | `user_roles` |

### 9.3 Edge Function Auth

- Funzioni critiche: JWT obbligatorio via `supabase.auth.getUser(token)`
- Funzioni server-to-server: accettano anche `service_role` key
- `generate-infographic`: `verify_jwt=false` ma validazione manuale via `getClaims()`

---

## 10. Feature Implementate

### 10.1 Feed

- Feed immersivo full-screen stile Spotify
- Gradient background estratto da immagini
- Double-tap per like
- Drag-to-select reaction picker (❤️👏🤯🤔😢)
- Pull-to-refresh
- Infinite scroll

### 10.2 Composer

- Rich text editor (Tiptap) con Markdown
- Limite 3000 caratteri con counter
- Upload media (foto/video) con preview
- **AI Infographic generation** (NanoBanana) — icona BarChart3, attiva con 50+ parole
- OCR/trascrizione on-demand per Gate
- Menzioni @username con autocomplete
- Conferma cancellazione bozza

### 10.3 Editoriale (Il Punto ◉)

- Carousel immersivo con badge "✨ AI SYNTHESIS"
- Deep content con FocusDetailSheet
- Sources drawer con link verificabili
- Commenti e reazioni dedicati
- Bookmarks focus
- Info dialog legale

### 10.4 Messaggi

- DM privati con thread
- Realtime WebSocket
- Media attachments
- Reazioni ai messaggi
- Cancellazione messaggi
- Condivisione post via DM

### 10.5 Profilo

- Avatar, bio, username personalizzabile
- Nebulosa cognitiva (Canvas/WebGL)
- Diario interazioni verificate
- Follower/following
- Online presence (last_seen)
- Settings privacy granulari

### 10.6 Ricerca

- Search bar con filtri
- Categorie: Persone, Post, Topics, Fonti, Media
- Trending topics AI-generated
- Recent searches

### 10.7 Notifiche

- Push notification (VAPID/WebPush)
- In-app notifications
- Preferenze granulari per tipo
- Notifica admin per nuovi utenti

### 10.8 Altre Feature

- Share sheet con people picker
- Reshare con contesto (quoted posts)
- Desktop layout responsive
- PWA installabile
- Age gate (16+)
- GDPR export dati
- Consent management versionato

---

## 11. Design System

### 11.1 Filosofia

- **Dark mode** default + Light mode
- **Glassmorphism:** blur, trasparenze, profondità
- **Urban/Grunge:** contrasti forti, accenti vibranti
- **Mobile-first:** touch gestures, haptic feedback

### 11.2 Colori Brand

| Nome | Valore | Uso |
|------|--------|-----|
| Primary Blue | `#0A7AFF` | CTA, link, azioni primarie |
| Dark Blue | `#1F3347` | Background secondari |
| Editorial Dark | `#0D1B2A` | Il Punto background |
| Brand Pink | `#E41E52` | Accenti, notifiche |
| Brand Yellow | `#FFD464` | Highlights, badge |
| Light Blue | `#BFE9E9` | Tag, chip light |

### 11.3 Typography

- **Display:** Inter Black / Impact
- **Body:** Inter
- **Mono:** JetBrains Mono

---

## 12. Privacy e Compliance GDPR

| Articolo | Requisito | Implementazione |
|----------|-----------|-----------------|
| Art. 5 | Minimizzazione | Solo dati necessari |
| Art. 6 | Base giuridica | Contratto + Consenso |
| Art. 7 | Consenso | Toggle espliciti, revocabili |
| Art. 8 | Minori | Age gate 16+ |
| Art. 13 | Informativa | Privacy Policy completa |
| Art. 15-22 | Diritti | Export, rettifica, cancellazione |
| Art. 25 | Privacy by Design | RLS, zero-knowledge gate |
| Art. 35 | DPIA | `docs/DPIA_LIGHT.md` |

**Documenti compliance:** `docs/3_LEGAL_PRIVACY_DATA_AUDIT.md`, `docs/DPIA_LIGHT.md`, `docs/RLS_AUDIT.md`

---

## 13. PWA e Push Notifications

- `public/manifest.json` — PWA manifest
- `public/sw.js` — Service worker
- VAPID keys per Web Push
- `send-push-notification` Edge Function
- Trigger DB automatici su notifiche e messaggi

---

## 14. Performance e Ottimizzazioni

| Area | Strategia |
|------|-----------|
| Data Fetching | TanStack Query (staleTime 5min, gcTime 30min) |
| Immagini | Progressive loading con thumbnail |
| Liste | Infinite scroll |
| Code Split | Lazy loading pagine |
| Cache AI | Content hash, negative caching, Lazy Trust |
| Bundle | Vite tree-shaking |

---

*Documento tecnico interno. Ultimo aggiornamento: 12 febbraio 2026*
