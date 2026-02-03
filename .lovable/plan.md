
# Piano di Correzione: Gate Comprehension - Regola d'Oro

## Problema Identificato

Nel `ComposerModal.tsx`, quando un utente fa un **reshare**, la logica del Gate usa erroneamente `wordCount` (le parole che l'utente sta scrivendo nel composer) invece del contenuto del **post originale citato**.

Questo viola la **Regola d'Oro**:
- ✅ Chi scrive non fa mai il test su se stesso
- ✅ Chi condivide fa il test sulla fonte originale
- ✅ Chi legge un reshare fa il test su tutto

---

## Errori Specifici nel Codice

### 1. `gateStatus` (righe 260-286)
```text
ERRORE: usa wordCount (commento dell'utente che sta resharing)
CORRETTO: usare getWordCount(quotedPost.content) (contenuto originale)
```

### 2. Reshare media con OCR (righe 536-557)
```text
ERRORE: const mediaGate = getMediaTestMode(wordCount, true)
CORRETTO: usare lunghezza del contenuto del post originale (quotedPost.content)
```

### 3. Logica generale reshare (righe 277-286)
```text
ERRORE: Applica gate sul commento dell'utente (30-120 parole)
CORRETTO: Gate basato SEMPRE sul contenuto originale, MAI sul commento del resharer
```

---

## Soluzione Proposta

### Principio Fondamentale
Nel **Composer** (fase di reshare), il Gate deve essere basato **esclusivamente** sulla fonte originale:
- **Post text-only citato**: Gate sul testo originale del post
- **Post con media OCR citato**: Gate sul contenuto estratto del media
- **Il commento che l'utente sta scrivendo**: MAI testato

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/composer/ComposerModal.tsx` | Correggere logica `gateStatus` e `handlePublish` |

---

## Modifiche Dettagliate

### 1. Variabile `quotedPostWordCount` (aggiungere dopo riga 178)
```text
Aggiungere una nuova variabile per contare le parole del post originale:
const quotedPostWordCount = quotedPost?.content ? getWordCount(quotedPost.content) : 0;
```

### 2. Correzione `gateStatus` - Reshare Media (righe 260-275)
```text
PRIMA:
  const mediaGate = getMediaTestMode(wordCount, true);

DOPO:
  // Per reshare, usa le parole del POST ORIGINALE (fonte), non il commento del resharer
  // Il resharer fa il test sulla fonte, non su ciò che sta scrivendo
  const mediaGate = getMediaTestMode(quotedPostWordCount, true);
```

### 3. Correzione `gateStatus` - Reshare Text-Only (righe 277-286)
```text
PRIMA:
  if (quotedPost) {
    const wordCount = getWordCount(content);  // ❌ Commento del resharer
    if (wordCount > 120) return { label: 'Gate completo', requiresGate: true };
    if (wordCount > 30) return { label: 'Gate light', requiresGate: true };
  }

DOPO:
  // Per reshare di post text-only, il Gate è basato sul POST ORIGINALE
  // L'utente che ricondivide fa il test sul contenuto che sta citando
  if (quotedPost && !quotedPostMediaWithExtractedText) {
    if (quotedPostWordCount > 120) {
      return { label: 'Gate completo (fonte)', requiresGate: true };
    }
    if (quotedPostWordCount > 30) {
      return { label: 'Gate light (fonte)', requiresGate: true };
    }
    // Post originale ≤30 parole: nessun gate
    return { label: 'Nessun gate', requiresGate: false };
  }
```

### 4. Correzione `handlePublish` - Reshare Media (righe 536-557)
```text
PRIMA:
  const mediaGate = getMediaTestMode(wordCount, true);

DOPO:
  // Per reshare, valuta sulla base del POST ORIGINALE, non del commento resharer
  const mediaGate = getMediaTestMode(quotedPostWordCount, true);
```

### 5. Aggiungere Branch per Reshare Text-Only nel `handlePublish`
Dopo il branch per reshare media (riga 558), aggiungere gestione per reshare di post text-only con >30 parole:
```text
// Branch for reshare of text-only posts (without media, without URL)
if (quotedPost && !quotedPostMediaWithExtractedText && !detectedUrl) {
  if (quotedPostWordCount > 30) {
    // Show reader for quoted post content
    setReaderSource({
      id: quotedPost.id,
      url: `post://${quotedPost.id}`,
      title: quotedPost.author?.full_name || quotedPost.author?.username,
      content: quotedPost.content,
      isOriginalPost: true,
      author: quotedPost.author?.username,
      authorFullName: quotedPost.author?.full_name,
      authorAvatar: quotedPost.author?.avatar_url,
    });
    setShowReader(true);
    return;
  }
  // ≤30 parole: nessun gate, pubblica direttamente
  await publishPost();
  return;
}
```

---

## Flusso Corretto dopo le Modifiche

```text
                    Composer: Reshare di un Post
                               │
                               ▼
              ┌────────────────────────────────────┐
              │  Tipo di contenuto originale?      │
              └────────────────────────────────────┘
          ┌──────────┴──────────┬──────────────────┐
          │                     │                   │
     Media con OCR        Text-Only            Con URL
          │                     │                   │
          ▼                     ▼                   ▼
   Gate su media         Gate su testo         Gate su URL
   (extracted_text)      (quotedPost.content)  (urlPreview)
          │                     │                   │
          │    ┌────────────────┴────────────────┐  │
          │    │     Parole POST ORIGINALE       │  │
          │    └────────────────┬────────────────┘  │
          │         │           │           │       │
          │        ≤30        31-120       >120     │
          │         │           │           │       │
          │         ▼           ▼           ▼       │
          │     NO GATE     1 domanda   3 domande   │
          │                   fonte       fonte     │
          │                                         │
          └─────────────────────────────────────────┘

      ⚠️ Il commento che l'utente scrive nel Composer
         NON viene MAI usato per determinare il gate
```

---

## Cosa NON Cambia

- Upload media nel Composer (utente è autore) → Già corretto nella conversazione precedente
- Flusso link/URL → Già corretto (usa `handleIOSQuizOnlyFlow` con `quotedPost.content`)
- Flusso commenti dal Feed → Non toccato
- Edge Functions → Non toccate
- Database/RLS → Non toccato

---

## Riepilogo Regola d'Oro Implementata

| Scenario | Chi fa il test? | Su cosa? |
|----------|-----------------|----------|
| Creazione post con URL | Autore | Fonte esterna (URL) |
| Creazione post con media OCR | Autore | Media (OCR/trascrizione) |
| Creazione post text-only | Autore | ❌ Nessun test |
| Reshare post text-only | Resharer | Testo originale del post citato |
| Reshare post con media OCR | Resharer | Media originale (OCR) |
| Lettura reshare nel Feed | Lettore | Tutto (fonte + commento sharer) |
