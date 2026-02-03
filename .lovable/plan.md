# Piano Gate Comprehension - Regola d'Oro

## ✅ IMPLEMENTATO

La logica del Gate nel Composer è stata corretta per rispettare la **Regola d'Oro**:

- ✅ **Chi scrive non fa mai il test su se stesso**
- ✅ **Chi condivide fa il test sulla fonte originale**
- ✅ **Chi legge un reshare fa il test su tutto**

---

## Modifiche Completate

### 1. Aggiunta `quotedPostWordCount` 
Nuova variabile che conta le parole del **POST ORIGINALE** (fonte), non del commento del resharer.

### 2. Corretta `gateStatus` 
- **Reshare media OCR**: usa `quotedPostWordCount` (fonte)
- **Reshare text-only**: usa `quotedPostWordCount` (fonte)
- Le label ora indicano `(fonte)` per chiarezza

### 3. Corretta `handlePublish`
- **Reshare media OCR**: usa `quotedPostWordCount` per determinare testMode
- **Nuovo branch reshare text-only**: genera quiz sul contenuto del post originale

### 4. Aggiunta `handleReshareTextOnlyGateFlow`
Nuova funzione che genera il quiz basato sul testo del post citato (>30 parole).

---

## Flusso Finale

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

## Riepilogo Regola d'Oro

| Scenario | Chi fa il test? | Su cosa? |
|----------|-----------------|----------|
| Creazione post con URL | Autore | Fonte esterna (URL) |
| Creazione post con media OCR | Autore | Media (OCR/trascrizione) |
| Creazione post text-only | Autore | ❌ Nessun test |
| Reshare post text-only | Resharer | Testo originale del post citato |
| Reshare post con media OCR | Resharer | Media originale (OCR) |
| Lettura reshare nel Feed | Lettore | Tutto (fonte + commento sharer) |

---

## File Modificati

- `src/components/composer/ComposerModal.tsx` - Corretta logica gate per reshare
- `src/lib/gate-utils.ts` - Funzioni utility già presenti (nessuna modifica necessaria)
