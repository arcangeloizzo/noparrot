# Piano: Componente Unificato "Mostra Tutto" per Testi Lunghi

## ✅ COMPLETATO

### Problema Risolto
Il testo troncato in vari tipi di post (reshare, media-only, quoted) non aveva il pulsante "Mostra tutto" per vedere il contenuto completo.

### Soluzione Implementata

#### Nuovi Componenti Creati

1. **`src/components/ui/expandable-text.tsx`**
   - Componente atomico per testo troncato con bottone "Mostra tutto"
   - Props: content, maxLength, maxLines, author, source, variant
   - Apre automaticamente FullTextModal al click

2. **`src/components/feed/FullTextModal.tsx`**
   - Modal unificato per visualizzare testo completo
   - Supporta varianti: 'post', 'caption', 'editorial', 'quoted'
   - Include action bar con Like, Commenta, Salva, Condividi
   - Stile glassmorphism con urban texture coerente

#### Componenti Aggiornati

3. **`src/components/feed/ImmersivePostCard.tsx`**
   - ✅ Stack Layout (reshare con commento lungo): aggiunto "Mostra tutto"
   - ✅ Media-only posts: aggiunto "Mostra tutto" per testi > 200 char
   - ✅ Sostituiti i due Dialog inline con FullTextModal (rimosso ~180 righe duplicate)

4. **`src/components/feed/QuotedPostCard.tsx`**
   - ✅ Intent posts: aggiunto "Mostra tutto" per testi > 200 char
   - ✅ Standard posts: aggiunto "Mostra tutto" per testi > 280 char

5. **`src/components/feed/QuotedEditorialCard.tsx`**
   - ✅ "Leggi tutto" ora è cliccabile e apre FullTextModal

### Risultato

| Tipo Post | Prima | Dopo |
|-----------|-------|------|
| Reshare con commento lungo | Troncato senza opzione | ✅ "Mostra tutto" |
| Post media-only | Troncato senza opzione | ✅ "Mostra tutto" |
| Quoted Post standard | Troncato senza opzione | ✅ "Mostra tutto" |
| Quoted Intent post | Troncato senza opzione | ✅ "Mostra tutto" |
| Editorial card | Testo statico | ✅ "Leggi tutto" cliccabile |

### Cosa NON è stato toccato
- ✅ Comprehension Gate e flusso quiz
- ✅ Commenti e reazioni
- ✅ OCR e trascrizione media
- ✅ Edge functions
- ✅ Database/RLS
- ✅ Autenticazione
