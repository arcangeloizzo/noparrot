
# Fix: Parsing Markdown nel Feed e Commenti

## Problema Identificato

Il Composer utilizza Tiptap che salva il testo formattato come **Markdown**:
- Bold → `**testo**`
- Italic → `_testo_`
- Underline → `~testo~`

Nel Composer l'utente vede la formattazione WYSIWYG, ma nel feed i marker vengono mostrati come testo grezzo (come visibile negli screenshot).

## Causa Root

Il componente `MentionText.tsx` gestisce solo le menzioni (`@utente`), ma non parsa i marker Markdown. Lo stesso componente viene usato in 9 file per renderizzare i contenuti di post e commenti.

## Soluzione Proposta

Estendere `MentionText.tsx` per parsare anche i marker Markdown, mantenendo la compatibilità con tutti i componenti esistenti.

### Approccio

Modificherò il flusso di parsing in `MentionText.tsx`:

```text
Testo input: "Questo è **bold**, _italic_ e ~underline~ con @utente"
        ↓
1. Split per menzioni (@...)
        ↓
2. Per ogni parte non-menzione, parso i marker Markdown:
   - **testo** → <strong>testo</strong>
   - _testo_ → <em>testo</em>  
   - ~testo~ → <u>testo</u>
        ↓
Output: Questo è <strong>bold</strong>, <em>italic</em> e <u>underline</u> con [bottone @utente]
```

### Dettagli Implementazione

Creerò una funzione `parseFormattedText()` che:
1. Usa regex per individuare i pattern Markdown
2. Restituisce un array di React nodes
3. Gestisce annidamenti semplici (es. `**_grassetto corsivo_**`)

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/feed/MentionText.tsx` | Aggiunta parsing Markdown nel rendering |

### Zero Regressione

- La signature del componente rimane identica (`text?: string, content?: string`)
- La gestione delle menzioni rimane invariata
- Il click handling sui profili non cambia
- Tutti i 9 file che usano `MentionText` beneficiano automaticamente del fix

---

## Sezione Tecnica

### Regex per Parsing Markdown

```typescript
// Pattern Markdown - ordine: bold prima (per evitare conflitti con italic)
const MARKDOWN_PATTERNS = [
  { regex: /\*\*([^*]+)\*\*/g, wrapper: 'strong' },  // **bold**
  { regex: /_([^_]+)_/g, wrapper: 'em' },            // _italic_
  { regex: /~([^~]+)~/g, wrapper: 'u' },             // ~underline~
];
```

### Funzione di Parsing

```typescript
const parseMarkdown = (text: string): React.ReactNode[] => {
  // Split complesso che preserva i match
  const segments: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  // Pattern combinato per trovare tutti i marker
  const combinedRegex = /(\*\*[^*]+\*\*|_[^_]+_|~[^~]+~)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = combinedRegex.exec(text)) !== null) {
    // Testo prima del match
    if (match.index > lastIndex) {
      segments.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    // Matched formatting
    const matchedText = match[0];
    if (matchedText.startsWith('**')) {
      segments.push(<strong key={key++}>{matchedText.slice(2, -2)}</strong>);
    } else if (matchedText.startsWith('_')) {
      segments.push(<em key={key++}>{matchedText.slice(1, -1)}</em>);
    } else if (matchedText.startsWith('~')) {
      segments.push(<u key={key++}>{matchedText.slice(1, -1)}</u>);
    }
    
    lastIndex = combinedRegex.lastIndex;
  }
  
  // Testo rimanente
  if (lastIndex < text.length) {
    segments.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  
  return segments;
};
```

### Flusso Aggiornato

```text
┌─────────────────────────────────────────────────────────┐
│                     MentionText                         │
├─────────────────────────────────────────────────────────┤
│  Input: "**bold** @utente _italic_"                     │
│                      ↓                                  │
│  1. Split per menzioni: ["**bold** ", "@utente", " _i..."]
│                      ↓                                  │
│  2. Per ogni parte:                                     │
│     - Se menzione → bottone cliccabile                  │
│     - Altrimenti → parseMarkdown()                      │
│                      ↓                                  │
│  Output: <strong>bold</strong> [bottone] <em>italic</em>│
└─────────────────────────────────────────────────────────┘
```

---

## Risultato Atteso

1. **Post nel Feed**: Il testo formattato appare con grassetto, corsivo e sottolineato
2. **Commenti**: Stessa formattazione visibile
3. **Menzioni**: Continuano a funzionare normalmente
4. **Composer**: Nessun cambiamento (già funziona con WYSIWYG)
5. **Backward compatible**: I post vecchi senza formatting vengono visualizzati normalmente
