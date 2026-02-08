# NoParrot — Documentazione Tecnica Completa

**Versione:** 2.0  
**Data:** 4 febbraio 2026  
**Stato:** Produzione

---

## Indice

1. [Mission e Purpose](#1-mission-e-purpose)
2. [Architettura Generale](#2-architettura-generale)
3. [I Quattro Pilastri](#3-i-quattro-pilastri)
4. [Stack Tecnologico](#4-stack-tecnologico)
5. [Struttura del Progetto](#5-struttura-del-progetto)
6. [Database e Schema](#6-database-e-schema)
7. [Autenticazione e Sicurezza](#7-autenticazione-e-sicurezza)
8. [Edge Functions](#8-edge-functions)
9. [Componenti Principali](#9-componenti-principali)
10. [Design System](#10-design-system)
11. [Privacy e Compliance](#11-privacy-e-compliance)
12. [Flussi Utente](#12-flussi-utente)
13. [Performance e Ottimizzazioni](#13-performance-e-ottimizzazioni)
14. [Configurazione e Deploy](#14-configurazione-e-deploy)

---

## 1. Mission e Purpose

### 1.1 La Visione

**NoParrot** nasce per combattere un problema fondamentale dell'era dell'informazione: **lo scrolling passivo**. 

Viviamo in un'epoca di sovraccarico informativo dove:
- Le persone consumano centinaia di titoli al giorno senza approfondire
- Il modello "engagement a tutti i costi" premia contenuti divisivi
- La comprensione reale viene sacrificata per la viralità
- Gli utenti ripetono opinioni altrui senza averle elaborate ("parroting")

### 1.2 La Mission

> **Trasformare lo scrolling passivo in comprensione attiva.**

NoParrot è una piattaforma cognitiva che:
1. **Rallenta il consumo** senza sacrificare l'esperienza
2. **Richiede comprensione** prima di permettere l'interazione sociale
3. **Visualizza la crescita intellettuale** dell'utente
4. **Sintetizza l'informazione** da fonti multiple in modo trasparente

### 1.3 Il Nome

**"No Parrot"** = Non ripetere come un pappagallo.

Prima di commentare, condividere o reagire a un contenuto, l'utente deve dimostrare di averlo compreso. Questo crea un ambiente dove le interazioni hanno peso e significato.

### 1.4 Manifesto del Prodotto

```
┌──────────────────────────────────────────────────────────────────┐
│                         NOPARROT                                  │
│                                                                   │
│   "Non basta informarsi. Bisogna comprendere."                   │
│                                                                   │
│   ◉ Ogni like ha un significato                                  │
│   ◉ Ogni commento richiede consapevolezza                        │
│   ◉ Ogni condivisione è una scelta informata                     │
│   ◉ La tua crescita intellettuale è visibile                     │
│                                                                   │
│   NoParrot non è un social network.                              │
│   È uno strumento per pensare meglio.                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Architettura Generale

### 2.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Feed      │  │  Il Punto   │  │   Profilo Cognitivo     │  │
│  │ Immersivo   │  │  Editorial  │  │   (Nebulosa)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOVABLE CLOUD (Supabase)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Database   │  │    Auth     │  │    Edge Functions       │  │
│  │  PostgreSQL │  │   + RLS     │  │    (Deno)               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Storage (avatars, media)                       ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Lovable AI │  │  Firecrawl  │  │    Jina/Supadata        │  │
│  │  (Gemini)   │  │  (Scraping) │  │    (Content Extraction) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Flusso Dati

```
Utente pubblica post con URL
         │
         ▼
┌─────────────────────┐
│   publish-post      │  ← Edge Function
│   (idempotent)      │
└─────────┬───────────┘
          │
          ├──────────────┬────────────────┬──────────────────┐
          ▼              ▼                ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐   ┌─────────────┐
│fetch-article│  │ transcribe  │  │ classify    │   │ generate-qa │
│  -preview   │  │  -youtube   │  │  -content   │   │  (Quiz AI)  │
└─────────────┘  └─────────────┘  └─────────────┘   └─────────────┘
          │              │                │                  │
          └──────────────┴────────────────┴──────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │   Post salvato in   │
                        │   database con:     │
                        │   - preview_img     │
                        │   - article_content │
                        │   - category        │
                        │   - quiz pronto     │
                        └─────────────────────┘
```

---

## 3. I Quattro Pilastri

### 3.1 Comprehension Gate (Cancello di Comprensione)

**Cos'è:**  
Un quiz generato da AI che l'utente deve superare per sbloccare le interazioni sociali su un post.

**Come funziona:**
1. L'utente legge il contenuto (articolo, video, post)
2. Prima di commentare/reagire, appare un quiz a scelta multipla
3. Le domande sono generate dall'AI basandosi sul contenuto reale
4. Se supera il quiz (≥60%), può interagire
5. Il gate "scade" dopo 365 giorni (deve rifarlo)

**Architettura Zero-Knowledge:**
```
                   ┌─────────────────────┐
                   │  post_qa_questions  │  ← Visibile all'utente
                   │  (solo domande)     │     (RLS: owner_id = auth.uid())
                   └─────────────────────┘
                              │
                              │ submit-qa (Edge Function)
                              │ compara in memory
                              ▼
                   ┌─────────────────────┐
                   │  post_qa_answers    │  ← MAI esposto al client
                   │  (risposte corrette)│     (RLS: service_role only)
                   └─────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Risposta:          │
                   │  { isCorrect: bool }│  ← Solo esito, MAI la risposta
                   └─────────────────────┘
```

**Modalità Gate:**
| Modalità | Descrizione |
|----------|-------------|
| `soft` | Nessun blocco, suggerimento lettura |
| `guardrail` | Attrito soft, test opzionale ma incentivato |
| `strict` | Blocco hard, test obbligatorio |

### 3.2 Trust Score (Punteggio di Fiducia)

**Cos'è:**  
Una valutazione dell'affidabilità della **fonte** (non del contenuto) basata su criteri oggettivi.

**Come funziona:**
1. Quando un post contiene un URL, l'Edge Function analizza la fonte
2. Valuta: reputazione storica, trasparenza, ownership, bias noti
3. Assegna un punteggio e una fascia (Basso/Medio/Alto)
4. Il badge appare sul post

**Importante:**  
> "Valutiamo la fonte, non il contenuto. Una fonte affidabile può pubblicare errori, una fonte meno affidabile può dire la verità."

**Cache:**  
I Trust Score sono cachati per 7 giorni per ridurre chiamate AI.

### 3.3 Il Punto ◉ (Sintesi Editoriale AI)

**Cos'è:**  
Un feed editoriale dove l'AI sintetizza notizie da fonti multiple su un singolo argomento.

**Caratteristiche:**
- **Non è giornalismo**: È aggregazione e sintesi algoritmica
- **Trasparenza totale**: Fonti sempre linkate e verificabili
- **Nessun Trust Score**: Per evitare di dare "autorità" alla sintesi
- **Badge chiaro**: "✨ AI SYNTHESIS" con timestamp

**Tipologie:**
| Tipo | Tabella | Descrizione |
|------|---------|-------------|
| Daily Focus | `daily_focus` | Notizie del giorno aggregate |
| Interest Focus | `interest_focus` | Approfondimenti per categoria |

**Disclaimer legale:**
```
"Sintesi automatica basata su fonti pubbliche.
NoParrot non è una testata giornalistica.
Non è fact-checking: apri le fonti per verificare il contesto."
```

### 3.4 Identità Cognitiva (Nebulosa)

**Cos'è:**  
Una visualizzazione della "mappa mentale" dell'utente basata sulle sue interazioni verificate.

**Come funziona:**
1. Solo interazioni che hanno superato il Gate vengono tracciate
2. I post sono categorizzati in 6 macro-aree
3. L'engagement per categoria viene aggregato
4. Una "nebulosa" interattiva mostra i pesi relativi

**Categorie:**
- Società
- Economia
- Tecnologia
- Cultura
- Politica
- Scienza

**Privacy:**
- **Opt-in esplicito** (default OFF)
- Dati visibili **solo all'utente stesso**
- Revocabile in qualsiasi momento
- MAI condiviso con terzi

---

## 4. Stack Tecnologico

### 4.1 Frontend

| Tecnologia | Versione | Uso |
|------------|----------|-----|
| React | 18.3+ | UI Framework |
| Vite | 5.x | Build tool |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | Component library |
| TanStack Query | 5.x | Data fetching/caching |
| React Router | 6.x | Routing |
| Framer Motion | 11.x | Animazioni |
| Tiptap | 3.x | Rich text editor |

### 4.2 Backend (Lovable Cloud)

| Servizio | Tecnologia | Uso |
|----------|------------|-----|
| Database | PostgreSQL | Storage dati |
| Auth | Supabase Auth | Autenticazione |
| RLS | PostgreSQL RLS | Row-level security |
| Functions | Deno (Edge) | Logica server |
| Storage | Supabase Storage | File/media |
| Realtime | Supabase Realtime | WebSocket updates |

### 4.3 AI e Servizi Esterni

| Servizio | Uso |
|----------|-----|
| Lovable AI (Gemini) | Quiz generation, Trust Score, Classificazione |
| Firecrawl | Estrazione articoli web |
| Jina/Supadata | Trascrizione YouTube |

---

## 5. Struttura del Progetto

```
noparrot/
├── src/
│   ├── components/
│   │   ├── auth/           # Login, signup, consent
│   │   ├── composer/       # Post creation (TiptapEditor, MediaUpload)
│   │   ├── debug/          # Error boundaries, perf overlay
│   │   ├── fab/            # Floating action button
│   │   ├── feed/           # Feed components (cards, comments, reactions)
│   │   │   ├── ImmersivePostCard.tsx      # Card principale post
│   │   │   ├── ImmersiveEditorialCarousel.tsx  # Il Punto carousel
│   │   │   ├── FocusDetailSheet.tsx       # Dettaglio editoriale
│   │   │   ├── CommentItem.tsx            # Singolo commento
│   │   │   ├── CommentsSheet.tsx          # Sheet commenti
│   │   │   └── skeletons/                 # Loading states
│   │   ├── media/          # MediaGallery, MediaViewer
│   │   ├── messages/       # DM system
│   │   ├── navigation/     # Header, BottomNav
│   │   ├── notifications/  # Push notification components
│   │   ├── onboarding/     # Splash, slides, consent
│   │   ├── profile/        # Profilo, Nebulosa, Settings
│   │   ├── search/         # Search UI, filters, results
│   │   ├── share/          # ShareSheet, PeoplePicker
│   │   └── ui/             # shadcn components + custom
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx # Auth state management
│   │
│   ├── hooks/
│   │   ├── useComments.ts          # CRUD commenti
│   │   ├── usePosts.ts             # CRUD post
│   │   ├── useLongPress.ts         # Gesture handler (drag-to-select)
│   │   ├── useCognitiveTracking.ts # Tracking nebulosa
│   │   ├── useFocusReactions.ts    # Reazioni editoriali
│   │   ├── useNotifications.ts     # Notifiche
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── comprehension-gate.tsx  # Gate logic
│   │   ├── gate-utils.ts           # Gate helpers
│   │   ├── haptics.ts              # Haptic feedback
│   │   ├── spotify-colors.ts       # Color extraction
│   │   └── utils.ts                # cn(), formatters
│   │
│   ├── pages/
│   │   ├── Index.tsx       # Onboarding/redirect
│   │   ├── Feed.tsx        # Main feed
│   │   ├── Post.tsx        # Single post view
│   │   ├── Profile.tsx     # User profile
│   │   ├── Search.tsx      # Search page
│   │   ├── Messages.tsx    # DM list
│   │   ├── Notifications.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   ├── TermsOfService.tsx
│   │   └── Transparency.tsx
│   │
│   ├── config/
│   │   └── brand.ts        # Brand colors, constants, feature flags
│   │
│   └── integrations/
│       └── supabase/
│           ├── client.ts   # Supabase client (auto-generated)
│           └── types.ts    # Database types (auto-generated)
│
├── supabase/
│   ├── functions/
│   │   ├── generate-qa/         # Quiz generation
│   │   ├── submit-qa/           # Quiz validation
│   │   ├── get-qa/              # Fetch quiz
│   │   ├── publish-post/        # Post creation pipeline
│   │   ├── fetch-article-preview/  # Article extraction
│   │   ├── transcribe-youtube/  # YT transcription
│   │   ├── classify-content/    # Category classification
│   │   ├── evaluate-trust-score/  # Trust score calc
│   │   ├── get-trust-score/     # Trust score fetch
│   │   ├── fetch-daily-focus/   # Il Punto generation
│   │   ├── export-user-data/    # GDPR export
│   │   └── send-push-notification/
│   │
│   └── config.toml          # Function configs
│
├── docs/
│   ├── TECHNICAL_DOCUMENTATION.md  # This file
│   ├── 3_LEGAL_PRIVACY_DATA_AUDIT.md
│   ├── DPIA_LIGHT.md
│   └── RLS_AUDIT.md
│
└── public/
    ├── manifest.json        # PWA manifest
    └── sw.js               # Service worker
```

---

## 6. Database e Schema

### 6.1 Tabelle Principali

#### Utenti e Profili

```sql
profiles (
  id UUID PRIMARY KEY,           -- Corrisponde a auth.users.id
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  date_of_birth DATE NOT NULL,   -- Per age gate (16+)
  cognitive_density JSONB,       -- Mappa cognitiva
  cognitive_tracking_enabled BOOLEAN DEFAULT true,
  editorial_notifications_enabled BOOLEAN DEFAULT true,
  -- Notification preferences...
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
)

user_consents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles,
  accepted_terms BOOLEAN,
  accepted_privacy BOOLEAN,
  ads_personalization_opt_in BOOLEAN,
  consent_version TEXT,
  -- Timestamps per ogni consenso
)
```

#### Contenuti

```sql
posts (
  id UUID PRIMARY KEY,
  author_id UUID REFERENCES profiles,
  content TEXT NOT NULL,
  shared_url TEXT,              -- URL condiviso
  shared_title TEXT,
  preview_img TEXT,
  article_content TEXT,         -- Contenuto estratto
  category TEXT,                -- Classificazione AI
  transcript TEXT,              -- Per video
  sources JSONB,
  hostname TEXT,
  created_at TIMESTAMPTZ
)

comments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts,
  author_id UUID REFERENCES profiles,
  content TEXT NOT NULL,
  parent_id UUID,               -- Per risposte nested
  level INTEGER DEFAULT 0,
  passed_gate BOOLEAN,          -- Ha superato il quiz?
  post_category TEXT,           -- Per tracking cognitivo
  created_at TIMESTAMPTZ
)

reactions (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts,
  user_id UUID REFERENCES profiles,
  reaction_type TEXT,           -- heart, clap, mind_blown, etc.
  created_at TIMESTAMPTZ
)
```

#### Quiz e Gate

```sql
post_qa_questions (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts,
  owner_id UUID NOT NULL,       -- Chi può vedere le domande
  questions JSONB,              -- Array di domande
  source_url TEXT,
  test_mode TEXT,               -- mcq, true_false, etc.
  generated_from TEXT,          -- 'gemini'
  expires_at TIMESTAMPTZ
)

post_qa_answers (
  id UUID PRIMARY KEY,          -- Stesso ID di post_qa_questions
  correct_answers JSONB,        -- Array di risposte corrette
  -- NO RLS per authenticated = solo service_role
)

post_gate_attempts (
  id UUID PRIMARY KEY,
  user_id UUID,
  post_id UUID,
  source_url TEXT,
  answers JSONB,
  score INTEGER,
  passed BOOLEAN,
  gate_type TEXT,
  expires_at TIMESTAMPTZ        -- 365 giorni
)
```

#### Editoriale (Il Punto)

```sql
daily_focus (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  deep_content TEXT,            -- Contenuto completo
  sources JSONB,                -- Array di fonti
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)

interest_focus (
  -- Struttura simile per approfondimenti per categoria
)

focus_comments (
  id UUID PRIMARY KEY,
  focus_id UUID,
  focus_type TEXT,              -- 'daily' | 'interest'
  author_id UUID REFERENCES profiles,
  content TEXT,
  is_editorial BOOLEAN,         -- Commento della redazione AI
  is_pinned BOOLEAN
)

focus_reactions (
  id UUID PRIMARY KEY,
  focus_id UUID,
  focus_type TEXT,
  user_id UUID,
  reaction_type TEXT
)
```

#### Messaggi

```sql
message_threads (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

thread_participants (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES message_threads,
  user_id UUID REFERENCES profiles,
  last_read_at TIMESTAMPTZ
)

messages (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES message_threads,
  sender_id UUID REFERENCES profiles,
  content TEXT,
  link_url TEXT,                -- Per condivisione post
  created_at TIMESTAMPTZ
)
```

### 6.2 View

```sql
-- View pubblica per profili (esclude PII)
CREATE VIEW public_profiles AS
SELECT 
  id, 
  username,
  full_name, 
  avatar_url, 
  bio, 
  created_at
FROM profiles;
-- Esclusi: date_of_birth, cognitive_density, notification settings
```

### 6.3 Funzioni Database

```sql
-- Check partecipazione thread
user_is_thread_participant(thread_id, user_id) → boolean

-- Crea o recupera thread esistente
create_or_get_thread(participant_ids[]) → thread_id

-- Estrae menzioni da testo
extract_mentions(content) → TABLE(username)

-- Conta condivisioni per URL
get_share_counts(shared_urls[]) → TABLE(count, shared_url)
```

---

## 7. Autenticazione e Sicurezza

### 7.1 Flusso Autenticazione

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Signup Form   │ ──▶ │   Supabase      │ ──▶ │   Confirm       │
│   (email, DOB)  │     │   Auth          │     │   Email         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Feed          │ ◀── │   Consent       │ ◀── │   Onboarding    │
│                 │     │   Screen        │     │   Slides        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 7.2 Age Gate

```typescript
// Validazione lato client
const age = new Date().getFullYear() - parseInt(yearOfBirth);
if (age < 16) {
  toast.error("Devi avere almeno 16 anni per iscriverti");
  return;
}
```

- DOB salvato in `profiles.date_of_birth` (NOT NULL)
- Blocco creazione account se età < 16

### 7.3 Row Level Security (RLS)

**Principio:** Ogni tabella ha RLS abilitato. Le policy definiscono chi può fare cosa.

| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| profiles | owner only | trigger | owner | ❌ |
| public_profiles | everyone | - | - | - |
| posts | authenticated | author | author | author |
| comments | authenticated | author | author | author |
| reactions | authenticated | owner | ❌ | owner |
| messages | participants | participant | ❌ | sender |
| post_qa_answers | **service_role** | service_role | service_role | service_role |
| trust_scores | **service_role** | service_role | service_role | ❌ |

**Tabelle protette (service_role only):**
- `post_qa_answers` - Risposte quiz
- `trust_scores` - Cache trust score
- `content_cache` - Articoli estratti
- `youtube_transcripts_cache` - Trascrizioni

### 7.4 Protezione API

```typescript
// Edge Function: verifica JWT
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401
  });
}
```

---

## 8. Edge Functions

### 8.1 Panoramica

| Function | JWT Required | Descrizione |
|----------|--------------|-------------|
| `generate-qa` | ❌ | Genera quiz da URL/contenuto |
| `get-qa` | ❌ | Recupera domande quiz |
| `submit-qa` | ❌ | Valida risposte (zero-knowledge) |
| `validate-answers` | ❌ | Endpoint legacy |
| `publish-post` | ❌ | Pipeline creazione post |
| `fetch-article-preview` | ✅ | Estrae preview articolo |
| `transcribe-youtube` | ❌ | Trascrizione video YT |
| `classify-content` | ✅ | Classifica categoria contenuto |
| `evaluate-trust-score` | ✅ | Calcola trust score |
| `get-trust-score` | ❌ | Fetch cached trust score |
| `fetch-daily-focus` | ❌ | Genera "Il Punto" |
| `export-user-data` | ❌ | GDPR data export |
| `send-push-notification` | ❌ | Invia push notification |

### 8.2 generate-qa

Genera quiz a scelta multipla basato sul contenuto.

```typescript
// Input
{
  url?: string,           // URL articolo/video
  content?: string,       // O contenuto testuale
  postId?: string,        // Per associare al post
  mode?: 'mcq' | 'true_false'
}

// Output
{
  qaId: string,
  questions: [
    {
      id: string,
      text: string,
      choices: [
        { id: string, text: string }
      ]
    }
  ]
}
```

**Modello AI:** Gemini 2.5 Flash  
**Cache:** Basato su content_hash (evita rigenerazione)

### 8.3 submit-qa

Valida le risposte senza mai esporre quelle corrette.

```typescript
// Input
{
  qaId: string,
  answers: [
    { questionId: string, choiceId: string }
  ]
}

// Output
{
  results: [
    { questionId: string, isCorrect: boolean }
  ],
  passed: boolean,
  score: number  // 0-100
}
```

**Rate Limiting:** Max 10 tentativi per quiz per 5 minuti

### 8.4 publish-post

Pipeline completa per la creazione di un post.

```typescript
// Flusso
1. Idempotency check (evita duplicati)
2. Crea post in database
3. Se URL presente:
   a. fetch-article-preview (title, image)
   b. transcribe-youtube (se video)
   c. classify-content (categoria)
   d. generate-qa (quiz)
4. Assegna topic (post_topics)
5. Ritorna post_id
```

---

## 9. Componenti Principali

### 9.1 Feed

#### ImmersivePostCard

Card principale per i post nel feed. Full-screen, stile Spotify.

```tsx
<ImmersivePostCard
  post={post}
  index={index}
  onCommentsOpen={() => {}}
  onShareOpen={() => {}}
  onSourcesOpen={() => {}}
/>
```

**Features:**
- Gradient background estratto da immagine
- Reaction picker con drag-to-select
- Swipe gestures
- Double-tap per like
- Pull-to-refresh

#### ImmersiveEditorialCarousel

Carousel per "Il Punto" (contenuti editoriali AI).

```tsx
<ImmersiveEditorialCarousel />
```

**Features:**
- Cards con "✨ AI SYNTHESIS" badge
- Deep content on tap
- Sources drawer
- Full-screen immersive

### 9.2 Comments

#### CommentItem

Singolo commento con supporto per nested replies.

```tsx
<CommentItem
  comment={comment}
  onReply={() => {}}
  isReply={false}
/>
```

**Features:**
- Reaction picker (drag-to-select)
- Reply threading
- Media attachments
- Menzioni @username

#### CommentsSheet

Bottom sheet per visualizzare tutti i commenti di un post.

### 9.3 Reactions

#### ReactionPicker

Picker per emoji reactions con drag-to-select.

```tsx
<ReactionPicker
  isOpen={showPicker}
  onSelect={(type) => handleReaction(type)}
  onClose={() => setShowPicker(false)}
  triggerRef={buttonRef}
  dragPosition={dragPos}  // Per drag-to-select
/>
```

**Emoji disponibili:**
| Type | Emoji | Significato |
|------|-------|-------------|
| heart | ❤️ | Apprezzo |
| clap | 👏 | Bravo |
| mind_blown | 🤯 | Illuminante |
| thinking | 🤔 | Fa pensare |
| sad | 😢 | Triste |

### 9.4 Gate

#### ComprehensionTest

Modal quiz per il Comprehension Gate.

```tsx
<ComprehensionTest
  postId={postId}
  sourceUrl={url}
  onComplete={(passed) => {}}
  onClose={() => {}}
/>
```

### 9.5 Profile

#### CognitiveNebulaCanvas

Visualizzazione WebGL della mappa cognitiva.

```tsx
<CognitiveNebulaCanvas
  density={userDensity}
  isExpanded={false}
/>
```

---

## 10. Design System

### 10.1 Filosofia

- **Dark mode only**: Esperienza immersiva, riduce affaticamento
- **Glassmorphism**: Blur, trasparenze, depth
- **Urban/Grunge**: Contrasti forti, accenti vibranti
- **Mobile-first**: Touch gestures, haptic feedback

### 10.2 Colori (HSL)

```css
/* index.css */
:root {
  --background: 222 84% 5%;        /* Quasi nero */
  --foreground: 210 40% 98%;       /* Bianco sporco */
  --card: 222 84% 8%;              /* Card dark */
  --primary: 207 90% 52%;          /* Blu brand #0A7AFF */
  --destructive: 0 84% 60%;        /* Rosso errori */
  --muted: 215 16% 47%;            /* Grigio muted */
  --accent: 350 90% 50%;           /* Pink accent #E41E52 */
}
```

### 10.3 Typography

- **Display:** Inter Black / Impact (per texture "FOCUS")
- **Body:** Inter
- **Mono:** JetBrains Mono (per codice, dati)

### 10.4 Spacing

Sistema 4px base:
- `p-1` = 4px
- `p-2` = 8px
- `p-4` = 16px
- `p-6` = 24px

### 10.5 Components (shadcn/ui)

Componenti base estesi:
- Button (varianti: default, outline, ghost, destructive)
- Card (glass effect)
- Sheet (bottom drawer)
- Dialog (modali)
- Toast (notifiche)
- Avatar
- Badge

### 10.6 Animazioni

```typescript
// Framer Motion patterns
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

const slideUp = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 }
};
```

---

## 11. Privacy e Compliance

### 11.1 GDPR Compliance

| Articolo | Requisito | Implementazione |
|----------|-----------|-----------------|
| Art. 5 | Minimizzazione | Solo dati necessari, retention definita |
| Art. 6 | Base giuridica | Contratto + Consenso dove necessario |
| Art. 7 | Consenso | Toggle espliciti, revocabili |
| Art. 13 | Informativa | Privacy Policy completa |
| Art. 15-22 | Diritti | Export, cancellazione, opposizione |
| Art. 25 | Privacy by Design | RLS, zero-knowledge gate |

### 11.2 Consensi

```
ConsentScreen
├── [x] Accetto Terms + Privacy (obbligatorio)
├── [ ] Cognitive Tracking (opt-in, default OFF)
└── [ ] Ads Personalization (opt-in, default OFF)
```

### 11.3 Data Retention

| Dato | Retention | Note |
|------|-----------|------|
| Account | Vita account | Fino a cancellazione |
| Gate attempts | 365 giorni | Auto-cleanup |
| Content cache | 7-30 giorni | Auto-cleanup |
| Logs | 30 giorni | Solo tecnici |

### 11.4 Diritti Utente

| Diritto | Come esercitarlo |
|---------|------------------|
| Accesso | Impostazioni → Privacy → Esporta dati |
| Rettifica | Modifica profilo |
| Cancellazione | Impostazioni → Privacy → Cancella account |
| Portabilità | Export JSON completo |
| Opposizione | Toggle tracking OFF |

---

## 12. Flussi Utente

### 12.1 Primo Accesso

```
App Launch
    │
    ▼
┌─────────────────┐
│  Splash Screen  │  (Logo animation)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Onboarding     │  (3-4 slides su valori)
│  Slides         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auth Page      │  (Login / Signup)
│  + Age Gate     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email Confirm  │  (Link inviato)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Consent Screen │  (Terms, Privacy, Opt-ins)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Feed           │  (Home)
└─────────────────┘
```

### 12.2 Pubblicazione Post con URL

```
Tap FAB (+)
    │
    ▼
┌─────────────────┐
│  ComposerModal  │
│  + Paste URL    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  publish-post   │  (Edge Function)
│  Pipeline       │
│  ├─ Preview     │
│  ├─ Classify    │
│  └─ Generate QA │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post Live      │
│  (Quiz ready)   │
└─────────────────┘
```

### 12.3 Interazione con Gate

```
Utente vuole commentare
         │
         ▼
┌─────────────────────┐
│  Ha già passato     │──── Sì ───▶ [Commento abilitato]
│  il gate?           │
└─────────┬───────────┘
          │ No
          ▼
┌─────────────────────┐
│  ComprehensionTest  │
│  (Quiz modal)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  submit-qa          │
│  (validazione)      │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
  Passed     Failed
    │           │
    ▼           ▼
[Commento]  [Retry o
 abilitato]  lettura]
```

---

## 13. Performance e Ottimizzazioni

### 13.1 Data Fetching

**TanStack Query:**
```typescript
const { data: posts } = useQuery({
  queryKey: ['posts', 'feed'],
  queryFn: fetchPosts,
  staleTime: 1000 * 60 * 5,  // 5 minuti
  gcTime: 1000 * 60 * 30,    // 30 minuti cache
});
```

### 13.2 Image Loading

**Progressive loading:**
```tsx
<ProgressiveImage
  src={fullUrl}
  placeholder={thumbnailUrl}
  alt={alt}
/>
```

### 13.3 Virtualization

Per liste lunghe (commenti, ricerca):
```tsx
// Infinite scroll con TanStack Query
const { fetchNextPage, hasNextPage } = useInfiniteQuery({...});
```

### 13.4 Code Splitting

```typescript
// Lazy loading pagine
const Feed = lazy(() => import('./pages/Feed'));
const Profile = lazy(() => import('./pages/Profile'));
```

### 13.5 PWA

- Service worker per caching
- Manifest per installazione
- Push notifications

---

## 14. Configurazione e Deploy

### 14.1 Environment Variables

```env
# Auto-generati da Lovable Cloud
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=xxx
```

### 14.2 Edge Functions Secrets

| Secret | Uso |
|--------|-----|
| `FIRECRAWL_API_KEY` | Estrazione articoli |
| `SUPADATA_API_KEY` | Trascrizione YouTube |

### 14.3 Deploy

**Preview:** Automatico su ogni commit
**Production:** Lovable → Share → Publish

### 14.4 URLs

- **Preview:** `https://id-preview--xxx.lovable.app`
- **Production:** `https://noparrot.lovable.app`

---

## Appendice A: Glossario

| Termine | Definizione |
|---------|-------------|
| **Comprehension Gate** | Quiz che l'utente deve superare per interagire |
| **Trust Score** | Valutazione affidabilità della fonte |
| **Il Punto** | Sintesi editoriale AI da fonti multiple |
| **Nebulosa** | Visualizzazione della mappa cognitiva |
| **Cognitive Density** | Pesi per categoria nella mappa |
| **RLS** | Row Level Security (PostgreSQL) |
| **Edge Function** | Funzione serverless Deno |
| **Zero-Knowledge** | Architettura dove il client non vede mai le risposte |

---

## Appendice B: Contatti

- **Email:** noparrot.info@gmail.com
- **Privacy Policy:** `/privacy`
- **Terms of Service:** `/terms`
- **Trasparenza AI:** `/transparency`

---

*Documento interno. Ultimo aggiornamento: 4 febbraio 2026*
