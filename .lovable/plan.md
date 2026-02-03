
# Piano: Componente Unificato "Mostra Tutto" per Testi Lunghi

## Problema Identificato

Il testo di Marco (nello screenshot) è troncato con "..." ma **manca il pulsante "Mostra tutto"** per vedere il contenuto completo. Questo problema è diffuso in vari tipi di post perché la logica di espansione del testo è frammentata in più punti del codice.

### Situazione Attuale
| Componente | Limite | Ha "Mostra tutto"? |
|------------|--------|---------------------|
| ImmersivePostCard (testo) | 400 char | Si |
| ImmersivePostCard (caption link) | 120 char | Si ("Leggi tutto") |
| ImmersivePostCard (media-only) | 200 char | **NO** |
| QuotedPostCard | 280 char | **NO** |
| QuotedEditorialCard | line-clamp-5 | Testo statico (non cliccabile) |

### Il Bug Specifico (Screenshot)
Il post di Marco è un **post con link** dove il commento dell'utente è lungo. Il testo viene troncato a 400 caratteri ma il bottone "Mostra tutto" non appare perché manca la gestione nel layout "stack" (reshare con commento lungo).

---

## Soluzione

Creare un **componente atomico `ExpandableText`** che:
1. Accetta testo + limite (caratteri o righe)
2. Mostra testo troncato con indicatore "..."
3. Aggiunge pulsante "Mostra tutto" se il testo supera il limite
4. Apre un modal/sheet unificato con il testo completo

Questo componente sostituirà tutte le implementazioni sparse e i due Dialog duplicati.

---

## Modifiche Tecniche

### 1. Nuovo Componente: `src/components/ui/expandable-text.tsx`

```text
Props:
- content: string (testo da mostrare)
- maxLength?: number (default 400)
- maxLines?: number (alternativa, usa CSS line-clamp)
- author?: { name, avatar, username } (per header del modal)
- showExpandButton?: boolean (default true)
- expandLabel?: string (default "Mostra tutto")
- className?: string

Comportamento:
- Se content.length <= maxLength: mostra tutto, nessun bottone
- Se content.length > maxLength: mostra slice + "..." + bottone
- Click su bottone → apre Dialog con testo completo
- Il Dialog ha lo stesso stile glassmorphism già usato
```

### 2. Nuovo Componente: `src/components/feed/FullTextModal.tsx`

Estrarre e unificare i due Dialog duplicati (righe 2200-2325 e 2327-2436) in un unico componente riutilizzabile:

```text
Props:
- isOpen: boolean
- onClose: () => void
- content: string
- author?: { name, avatar, username }
- source?: { hostname, url } (per caption esterne)
- variant: 'post' | 'caption' | 'editorial'
- actionBar?: ReactNode (opzionale, per azioni custom)
```

### 3. Aggiornamenti a ImmersivePostCard.tsx

| Sezione | Modifica |
|---------|----------|
| Righe 1329-1340 | Usare `<ExpandableText>` nel layout stack |
| Righe 1358-1376 | Sostituire logica inline con `<ExpandableText>` |
| Righe 1379-1397 | Sostituire logica inline con `<ExpandableText>` |
| Righe 1400-1434 | Usare `<ExpandableText>` nei post solo testo |
| Righe 1437-1441 | **FIX**: Aggiungere `<ExpandableText>` ai post media-only |
| Righe 1852-1876 | Usare `<ExpandableText>` per caption lunghe |
| Righe 2200-2436 | Rimuovere i due Dialog inline, usare `<FullTextModal>` |

### 4. Aggiornamenti a QuotedPostCard.tsx

| Sezione | Modifica |
|---------|----------|
| Righe 82-84 | Sostituire troncamento JS con `<ExpandableText>` |
| Righe 118-122 | Usare `<ExpandableText>` per Intent posts (invece di line-clamp-4) |

### 5. Aggiornamenti a QuotedEditorialCard.tsx

| Sezione | Modifica |
|---------|----------|
| Righe 75-79 | Rendere "Leggi tutto" cliccabile con `<ExpandableText>` |

---

## Flusso Visivo

```text
                     Testo lungo nel feed
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Testo troncato + "..."     │
              │  [Mostra tutto]             │
              └─────────────────────────────┘
                            │
                        Click
                            │
                            ▼
              ┌─────────────────────────────┐
              │  FullTextModal              │
              │  ┌───────────────────────┐  │
              │  │ 👤 Nome Autore        │  │
              │  │    @username          │  │
              │  ├───────────────────────┤  │
              │  │                       │  │
              │  │  Testo completo       │  │
              │  │  scrollabile...       │  │
              │  │                       │  │
              │  ├───────────────────────┤  │
              │  │ [Condividi] ♡ 💬 🔖   │  │
              │  │ [Torna al feed]       │  │
              │  └───────────────────────┘  │
              └─────────────────────────────┘
```

---

## Cosa NON viene toccato

- Comprehension Gate e flusso quiz
- Commenti e reazioni
- OCR e trascrizione media
- Edge functions
- Database/RLS
- Autenticazione

---

## File Coinvolti

| File | Azione |
|------|--------|
| `src/components/ui/expandable-text.tsx` | Nuovo |
| `src/components/feed/FullTextModal.tsx` | Nuovo |
| `src/components/feed/ImmersivePostCard.tsx` | Modifica |
| `src/components/feed/QuotedPostCard.tsx` | Modifica |
| `src/components/feed/QuotedEditorialCard.tsx` | Modifica |

---

## Risultato Atteso

- **Tutti** i testi lunghi avranno "Mostra tutto" visibile
- **Un unico stile** per il modal di espansione
- **Meno codice duplicato** (rimozione ~150 righe)
- **Nessun impatto** su logiche core (gate, commenti, ecc.)
