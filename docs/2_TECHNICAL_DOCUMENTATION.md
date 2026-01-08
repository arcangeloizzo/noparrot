# NoParrot - Documentazione Tecnica Completa

**Versione:** 2.0  
**Data:** 8 gennaio 2026  
**Documento per:** Onboarding AI Esterni

---

## 1. Stack Tecnologico

### Frontend
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| React | 18.3.1 | UI Framework |
| Vite | latest | Build tool |
| TypeScript | strict | Type safety |
| Tailwind CSS | 3.x | Styling |
| React Router | 6.30.1 | Routing |
| TanStack Query | 5.83.0 | Data fetching & caching |
| Framer Motion | implicit | Animazioni |
| Radix UI | various | Componenti accessibili |
| shadcn/ui | various | Design system base |

### Backend (Lovable Cloud / Supabase)
| Tecnologia | Uso |
|------------|-----|
| Supabase | Database, Auth, Storage, Edge Functions |
| PostgreSQL | Database relazionale |
| Deno | Runtime Edge Functions |
| Row Level Security (RLS) | Sicurezza dati |

### AI Services
| Provider | Modello | Uso |
|----------|---------|-----|
| Lovable AI Gateway | google/gemini-2.5-flash | Default per quiz, classificazione |
| Lovable AI Gateway | google/gemini-2.5-flash-lite | Classificazione leggera |
| Lovable AI Gateway | google/gemini-2.5-pro | Sintesi complesse (Il Punto) |

### External Services
| Servizio | Uso |
|----------|-----|
| Jina AI Reader | Estrazione contenuto articoli |
| Firecrawl | Estrazione articoli (fallback) |
| Supadata | Trascrizioni YouTube |
| Spotify API | Metadata tracce |
| Genius API | Lyrics |
| Google News RSS | Feed notizie per Il Punto |

---

## 2. Architettura Applicativa

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│  Pages          │  Components        │  Hooks               │
│  - Feed.tsx     │  - FeedCard.tsx    │  - usePosts.ts       │
│  - Profile.tsx  │  - FocusCard.tsx   │  - useDailyFocus.ts  │
│  - Search.tsx   │  - QuizModal.tsx   │  - useComments.ts    │
│  - Messages.tsx │  - CommentsSheet   │  - useUserConsents   │
└─────────────────┬───────────────────────────────────────────┘
                  │ Supabase Client
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   EDGE FUNCTIONS (Deno)                     │
├─────────────────────────────────────────────────────────────┤
│  AI-Powered            │  Utility              │  Security  │
│  - generate-qa         │  - fetch-article      │  - submit-qa
│  - fetch-daily-focus   │  - transcribe-youtube │  - get-qa  │
│  - evaluate-trust      │  - fetch-lyrics       │  - validate│
│  - classify-content    │  - export-user-data   │            │
└─────────────────┬───────────────────────────────────────────┘
                  │ Service Role
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────┤
│  Core Tables           │  Cache Tables         │  Security  │
│  - profiles            │  - content_cache      │  - RLS     │
│  - posts               │  - youtube_transcripts│  - Policies│
│  - comments            │  - trust_scores       │            │
│  - daily_focus         │  - post_qa_questions  │            │
│  - user_consents       │  - post_qa_answers    │            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### Tabelle Principali

#### profiles
```sql
id                          UUID PRIMARY KEY
username                    TEXT UNIQUE NOT NULL
full_name                   TEXT
avatar_url                  TEXT
bio                         TEXT
date_of_birth               DATE NOT NULL        -- Age gate 16+
cognitive_density           JSONB                -- Mappa interessi
cognitive_tracking_enabled  BOOLEAN DEFAULT true -- Opt-out profilazione
last_seen_at                TIMESTAMPTZ
created_at                  TIMESTAMPTZ
```

#### posts
```sql
id                UUID PRIMARY KEY
author_id         UUID REFERENCES profiles(id)
content           TEXT NOT NULL
category          TEXT                          -- Classificazione AI
shared_url        TEXT                          -- URL fonte condivisa
shared_title      TEXT
preview_img       TEXT
transcript        TEXT                          -- Per video/audio
sources           JSONB                         -- Array fonti
trust_level       TEXT                          -- BASSO/MEDIO/ALTO
quoted_post_id    UUID                          -- Per reshare
shares_count      INTEGER DEFAULT 0
created_at        TIMESTAMPTZ
```

#### daily_focus (Il Punto)
```sql
id                UUID PRIMARY KEY
title             TEXT NOT NULL                 -- Max 60 chars
summary           TEXT NOT NULL                 -- 400-500 chars
deep_content      TEXT                          -- 1500-2000 chars
sources           JSONB NOT NULL                -- Array fonti
image_url         TEXT
category          TEXT
trust_score       TEXT
topic_cluster     TEXT                          -- Dedup clustering
angle_tag         TEXT                          -- Angolo editoriale
event_fingerprint TEXT                          -- Dedup fingerprint
edition_time      TEXT                          -- Edizione giornaliera
expires_at        TIMESTAMPTZ
created_at        TIMESTAMPTZ
```

#### comments
```sql
id                          UUID PRIMARY KEY
post_id                     UUID REFERENCES posts(id)
author_id                   UUID REFERENCES profiles(id)
content                     TEXT NOT NULL
parent_id                   UUID                  -- Thread nesting
level                       INTEGER DEFAULT 0     -- Depth
passed_gate                 BOOLEAN DEFAULT false -- Comprensione verificata
post_category               TEXT
user_density_before_comment JSONB                 -- Snapshot cognitivo
created_at                  TIMESTAMPTZ
```

#### user_consents
```sql
id                          UUID PRIMARY KEY
user_id                     UUID UNIQUE REFERENCES profiles(id)
accepted_terms              BOOLEAN DEFAULT false
accepted_privacy            BOOLEAN DEFAULT false
ads_personalization_opt_in  BOOLEAN DEFAULT false
consent_version             TEXT DEFAULT '2.0'
terms_accepted_at           TIMESTAMPTZ
privacy_accepted_at         TIMESTAMPTZ
ads_opt_in_at               TIMESTAMPTZ
created_at                  TIMESTAMPTZ
updated_at                  TIMESTAMPTZ
```

### Tabelle Quiz (Security Hardened)

#### post_qa_questions (Public - No Answers)
```sql
id              UUID PRIMARY KEY
owner_id        UUID NOT NULL                   -- Chi ha generato
post_id         UUID REFERENCES posts(id)
source_url      TEXT
questions       JSONB NOT NULL                  -- Solo domande, NO correctId
content_hash    TEXT                            -- Cache invalidation
test_mode       TEXT                            -- SOURCE_ONLY/MIXED/USER_ONLY
generated_from  TEXT
expires_at      TIMESTAMPTZ                     -- 30 days default
generated_at    TIMESTAMPTZ
```

#### post_qa_answers (Private - Service Role Only)
```sql
id              UUID PRIMARY KEY REFERENCES post_qa_questions(id)
correct_answers JSONB NOT NULL                  -- {q1: "a", q2: "b", q3: "c"}
created_at      TIMESTAMPTZ
```

#### qa_submit_attempts (Rate Limiting)
```sql
id              UUID PRIMARY KEY
user_id         UUID NOT NULL
qa_id           UUID REFERENCES post_qa_questions(id)
attempt_count   INTEGER DEFAULT 0
window_start    TIMESTAMPTZ
last_attempt_at TIMESTAMPTZ
```

### Tabelle Cache

#### content_cache
```sql
id              UUID PRIMARY KEY
source_url      TEXT UNIQUE
source_type     TEXT                            -- article/tweet/etc
content_text    TEXT NOT NULL
title           TEXT
expires_at      TIMESTAMPTZ                     -- 7 days default
created_at      TIMESTAMPTZ
```

#### youtube_transcripts_cache
```sql
id              UUID PRIMARY KEY
video_id        TEXT NOT NULL
transcript      TEXT NOT NULL
language        TEXT
source          TEXT                            -- supadata/youtube-api
expires_at      TIMESTAMPTZ                     -- 30 days
cached_at       TIMESTAMPTZ
```

#### trust_scores
```sql
id              UUID PRIMARY KEY
source_url      TEXT UNIQUE
score           NUMERIC
band            TEXT                            -- BASSO/MEDIO/ALTO
reasons         JSONB                           -- Spiegazioni
calculated_at   TIMESTAMPTZ
expires_at      TIMESTAMPTZ                     -- 7 days
```

---

## 4. Edge Functions

### Core AI Functions

#### generate-qa
**Scopo:** Genera quiz di comprensione da contenuto
**Input:** `{ sourceUrl, contentId, testMode, questionCount, qaSourceRef }`
**Output:** `{ qaId, questions }` (NO correctId)
**Sicurezza:**
- Fetch contenuto server-side (mai dal client)
- Salva answers in tabella separata (post_qa_answers)
- Strip correctId prima di restituire

#### submit-qa
**Scopo:** Valida risposte quiz server-side
**Input:** `{ qaId, answers }`
**Output:** `{ passed, score, wrongIndexes }`
**Sicurezza:**
- Rate limiting: 10 tentativi / 5 minuti
- Mai restituisce risposte corrette
- Logging in post_gate_attempts

#### fetch-daily-focus
**Scopo:** Genera sintesi editoriale "Il Punto"
**Input:** `{}`
**Output:** Daily focus con sources
**Features:**
- Deduplicazione intelligente (fingerprint + similarity)
- Cluster quota: max 2 per topic in 24h
- Classificazione topic/angle automatica

#### evaluate-trust-score
**Scopo:** Calcola Trust Score per URL
**Input:** `{ url }`
**Output:** `{ score, band, reasons }`
**Metodologia:**
- Reputazione dominio
- Trasparenza editoriale
- Storico verificabilità

### Utility Functions

| Function | Scopo |
|----------|-------|
| fetch-article-preview | Estrae metadata articolo |
| transcribe-youtube | Ottiene trascrizione video |
| fetch-lyrics | Recupera lyrics da Genius |
| classify-content | Categorizza contenuto |
| export-user-data | GDPR data export |
| send-push-notification | Push via Web Push API |

---

## 5. Hooks Principali

### Data Fetching
```typescript
usePosts()              // Feed posts con pagination
useDailyFocus()         // Carosello Il Punto
useComments(postId)     // Commenti per post
useFocusComments()      // Commenti per Il Punto
useNotifications()      // Notifiche utente
useMessages()           // Messaggi privati
```

### User State
```typescript
useCurrentProfile()     // Profilo utente corrente
useUserConsents()       // Consensi privacy/ads
useCognitiveTracking()  // Update cognitive density
useBlockTracking()      // Reader gate progress
```

### Actions
```typescript
useMediaUpload()        // Upload media
useFocusBookmarks()     // Salvataggio focus
useCommentReactions()   // Like commenti
useFocusReactions()     // Reactions Il Punto
```

---

## 6. Flussi Chiave

### Comprehension Gate Flow

```
1. User clicca "Commenta" o "Condividi"
2. Frontend chiama generate-qa con qaSourceRef
3. Edge function:
   a. Fetch contenuto server-side (cache o fresh)
   b. Genera quiz via Gemini
   c. Salva questions → post_qa_questions
   d. Salva answers → post_qa_answers (separato!)
   e. Ritorna { qaId, questions } (NO correctId)
4. User risponde alle domande
5. Frontend chiama submit-qa con { qaId, answers }
6. Edge function:
   a. Check rate limit
   b. Fetch correct_answers da post_qa_answers
   c. Valida risposte
   d. Ritorna { passed, score, wrongIndexes }
7. Se passed=true → azione sbloccata
8. Se passed=false → retry con feedback
```

### Il Punto Generation Flow

```
1. Cron/Manual trigger fetch-daily-focus
2. Fetch RSS da Google News Italia
3. Per ogni item:
   a. Dedup: check fingerprint esistente
   b. Dedup: check similarity semantica
   c. Se duplicato → skip con reason
4. Classificazione topic/angle via AI
5. Search articoli correlati (multi-source)
6. Generazione sintesi via Gemini Pro:
   - TITLE: max 60 chars, formato analitico
   - SUMMARY: 400-500 chars, lead
   - DEEP_CONTENT: 1500-2000 chars, analisi
7. Fetch immagine (Jina → OG fallback)
8. Salvataggio in daily_focus con metadata
```

### Consent Flow

```
1. Primo accesso → Onboarding slides
2. Click "Crea account" → ConsentScreen
3. User accetta Terms + Privacy (obbligatorio)
4. User toggle Ads personalization (opzionale)
5. Salvataggio localStorage (pre-auth)
6. Redirect → AuthPage
7. Login/Signup
8. AuthContext → syncPendingConsents()
9. Upsert in user_consents table
10. Clear localStorage pending
```

---

## 7. Sicurezza

### RLS Policies Critiche

| Tabella | Policy | Accesso |
|---------|--------|---------|
| profiles | Read own | `auth.uid() = id` |
| posts | Read all, Write own | Public read, owner write |
| post_qa_questions | Read own | `owner_id = auth.uid()` |
| post_qa_answers | **NONE** | Service role only |
| qa_submit_attempts | **NONE** | Service role only |
| user_consents | CRUD own | `auth.uid() = user_id` |

### Gate Security Hardening

1. **Separation of concerns:** Questions e Answers in tabelle separate
2. **No client access:** post_qa_answers ha 0 policies RLS
3. **Rate limiting:** Max 10 tentativi / 5 minuti per qa_id
4. **Server-side validation:** submit-qa è l'unica fonte di verità
5. **No bypass:** Tutti i metodi legacy deprecati con throw Error

### Secrets Management

| Secret | Uso |
|--------|-----|
| LOVABLE_API_KEY | AI Gateway (auto-provisioned) |
| SUPABASE_SERVICE_ROLE_KEY | Edge functions |
| FIRECRAWL_API_KEY | Article extraction |
| SUPADATA_API_KEY | YouTube transcripts |
| SPOTIFY_CLIENT_ID/SECRET | Spotify API |
| GENIUS_API_KEY | Lyrics |
| VAPID_PRIVATE_KEY | Web Push |

---

## 8. File Structure

```
src/
├── components/
│   ├── auth/           # AuthPage, login/signup
│   ├── composer/       # Post composer, gate modals
│   ├── feed/           # Cards, comments, focus
│   ├── navigation/     # Header, bottom nav
│   ├── onboarding/     # Slides, mission, splash
│   ├── profile/        # Cognitive map, settings
│   ├── search/         # Search UI
│   └── ui/             # shadcn components
├── contexts/
│   └── AuthContext.tsx # Auth state management
├── hooks/              # Custom React hooks
├── lib/                # Utilities, AI helpers
├── pages/              # Route components
├── config/
│   └── brand.ts        # Brand config, feature flags
└── integrations/
    └── supabase/       # Auto-generated types & client

supabase/
├── functions/          # Edge functions (Deno)
│   ├── generate-qa/
│   ├── submit-qa/
│   ├── fetch-daily-focus/
│   └── ...
└── config.toml         # Supabase config

docs/
├── 1_APP_SCOPE_KEY_FOCUS.md
├── 2_TECHNICAL_DOCUMENTATION.md
├── 3_LEGAL_PRIVACY_DATA_AUDIT.md
├── LEGAL_PRIVACY_IMPLEMENTATION.md
└── RLS_AUDIT.md
```

---

## 9. Environment Variables

```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

---

## 10. Testing Endpoints

### Edge Functions (via Supabase)
```bash
# Generate quiz
POST /functions/v1/generate-qa
Authorization: Bearer [user-token]
{ "sourceUrl": "...", "testMode": "SOURCE_ONLY" }

# Submit answers
POST /functions/v1/submit-qa
Authorization: Bearer [user-token]
{ "qaId": "...", "answers": {"q1": "a", "q2": "b", "q3": "c"} }

# Fetch daily focus
POST /functions/v1/fetch-daily-focus
Authorization: Bearer [service-role]
{}
```

---

*Documento generato per supportare l'onboarding di AI esterni. Per audit legale vedere `3_LEGAL_PRIVACY_DATA_AUDIT.md`.*
