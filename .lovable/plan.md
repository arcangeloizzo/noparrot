
# Piano: Gate Comprehension per Media (Video/Immagini)

## Riepilogo Situazione Attuale

Il Composer attualmente gestisce i media uploadati in questo modo:
- **Media CON OCR/trascrizione**: Gate attivo con 3 domande sul media (SOURCE_ONLY)
- **Media SENZA OCR/trascrizione**: Nessun Gate, pubblicazione diretta

Questo non è coerente con le regole applicate agli altri tipi di contenuto (link, reshare, ecc.).

---

## Nuove Regole da Implementare

### SCENARIO 1: Media SENZA OCR/Trascrizione
| Parole commento | Gate |
|-----------------|------|
| 0-30 parole | ❌ Nessun Gate |
| 31-120 parole | ✅ Gate light: 1 domanda sul commento |
| >120 parole | ✅ Gate completo: 3 domande sul commento |

### SCENARIO 2: Media CON OCR/Trascrizione
| Parole commento | Gate |
|-----------------|------|
| 0-30 parole | ✅ Gate solo media: 3 domande sul media |
| 31-120 parole | ✅ Gate mixed: 1 domanda sul commento + 2 sul media |
| >120 parole | ✅ Gate completo: 3 domande sul commento |

---

## Modifiche Tecniche

### 1. Nuovo Type e Funzione in `src/lib/gate-utils.ts`

```text
Nuova funzione: getMediaTestMode(userWordCount, hasExtractedText)
Restituisce: { testMode, questionCount, gateRequired }

Logica:
- hasExtractedText=false && words≤30 → NO GATE
- hasExtractedText=false && words 31-120 → USER_ONLY, 1 domanda
- hasExtractedText=false && words>120 → USER_ONLY, 3 domande
- hasExtractedText=true && words≤30 → SOURCE_ONLY, 3 domande
- hasExtractedText=true && words 31-120 → MIXED, 3 domande (1+2)
- hasExtractedText=true && words>120 → USER_ONLY, 3 domande
```

### 2. Aggiornamento `gateStatus` in `ComposerModal.tsx` (righe 226-258)

La funzione `gateStatus` deve riflettere le nuove regole per mostrare feedback in tempo reale.

Modifiche:
- Aggiungere branch per media SENZA OCR ma CON commento lungo
- Distinguere tra "Gate su commento" e "Gate su media"
- Label dinamiche: "Gate light (1 domanda)", "Gate mixed", "Gate completo"

### 3. Aggiornamento `handlePublish` in `ComposerModal.tsx` (righe 419-497)

Attualmente:
```text
if (mediaWithExtractedText) → handleMediaGateFlow (SOURCE_ONLY)
else if (no detectedUrl && no quotedPost) → publishPost() direttamente
```

Modifiche:
- Aggiungere branch per media SENZA OCR ma CON commento lungo (≥30 parole)
- Chiamare `handleMediaGateFlow` con testMode appropriato
- Passare `userText` al backend per generazione quiz su commento

### 4. Aggiornamento `handleMediaGateFlow` in `ComposerModal.tsx` (righe 500-569)

Attualmente forza `testMode: 'SOURCE_ONLY'`.

Modifiche:
- Accettare parametro `testMode` dinamico dalla nuova funzione `getMediaTestMode`
- Passare `questionCount` corretto (1 o 3)
- Gestire caso `USER_ONLY` per media senza OCR (quiz solo su commento)

### 5. Aggiornamento Edge Function `generate-qa/index.ts` (righe 700-730)

Il case `mediaId` deve supportare:
- `testMode: 'USER_ONLY'` → usa solo `userText` per generare domande
- `testMode: 'MIXED'` → combina extracted_text + userText
- `testMode: 'SOURCE_ONLY'` → usa solo extracted_text (già funziona)

---

## Flusso Decisionale

```text
                      Upload Media nel Composer
                               │
                               ▼
              ┌────────────────────────────────────┐
              │ Ha OCR/Trascrizione attivata?      │
              └────────────────────────────────────┘
                    │                       │
                   NO                      SI
                    │                       │
                    ▼                       ▼
           ┌──────────────┐         ┌──────────────┐
           │ Parole ≤30?  │         │ Parole ≤30?  │
           └──────────────┘         └──────────────┘
              │       │                │       │
             SI      NO               SI      NO
              │       │                │       │
              ▼       ▼                ▼       ▼
         NO GATE   31-120?       SOURCE_ONLY  31-120?
                     │              (3)          │
                    SI                          SI
                     │                           │
                     ▼                           ▼
               USER_ONLY                      MIXED
                 (1)                         (1+2)
                     │                           │
                    NO (>120)                   NO (>120)
                     │                           │
                     ▼                           ▼
               USER_ONLY                    USER_ONLY
                 (3)                          (3)
```

---

## File Coinvolti

| File | Azione |
|------|--------|
| `src/lib/gate-utils.ts` | Aggiungere `getMediaTestMode()` |
| `src/components/composer/ComposerModal.tsx` | Modificare `gateStatus`, `handlePublish`, `handleMediaGateFlow` |
| `supabase/functions/generate-qa/index.ts` | Supportare USER_ONLY/MIXED per mediaId |

---

## Cosa NON viene toccato

- Flusso link/URL (già funziona)
- Flusso reshare di post (già funziona)
- Flusso commenti dal feed (già funziona)
- OCR/trascrizione extraction (già funziona)
- UI del Composer (nessuna modifica visuale)
- Altri Edge Functions
- Database/RLS

---

## Risultato Atteso

- Media senza OCR + commento lungo → Quiz sul commento dell'utente
- Media con OCR + commento corto → Quiz sul contenuto estratto
- Media con OCR + commento lungo → Quiz misto o solo su commento
- Coerenza con le regole già applicate a link e reshare
