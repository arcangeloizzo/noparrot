
# Piano di Implementazione: Rich Text Markdown + Media Shortcuts Diretti

## Stato Corrente
Ho analizzato entrambi i file (`ComposerModal.tsx` e `MediaActionBar.tsx`) e sono pronto ad applicare le modifiche tecniche come da piano approvato.

---

## Modifiche da Applicare

### 1. MediaActionBar.tsx - Refactoring Completo

**Nuova prop `onFormat`:**
```tsx
interface MediaActionBarProps {
  onFilesSelected: (files: File[], type: 'image' | 'video') => void;
  disabled?: boolean;
  maxImages?: number;
  maxVideos?: number;
  characterCount?: number;
  maxCharacters?: number;
  onFormat?: (format: 'bold' | 'italic' | 'underline') => void;  // NEW
}
```

**Pulsanti B/I/U con haptics:**
```tsx
const handleFormat = (format: 'bold' | 'italic' | 'underline') => {
  haptics.light();
  onFormat?.(format);
};

// Collegamento ai pulsanti:
<button onClick={() => handleFormat('bold')}>...</button>
<button onClick={() => handleFormat('italic')}>...</button>
<button onClick={() => handleFormat('underline')}>...</button>
```

**Tre input file separati:**

| Input | Accept | Attributi | Scopo |
|-------|--------|-----------|-------|
| Camera | `image/*,video/*` | `capture="environment"` | Scatto diretto |
| Gallery | `image/*,video/*` | `multiple` | Galleria foto/video |
| Files | `*/*` | - | Documenti generici |

**Handler `handleFileChange` per file generici:**
```tsx
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  const file = files[0];
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  
  if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
    toast.info('File allegato. Verrà caricato come documento.');
  }
  validateAndSelect(files, type, ...);
};
```

---

### 2. ComposerModal.tsx - Funzione `applyFormatting`

**Nuova funzione (dopo linea ~252, dopo `handleSelectMention`):**
```tsx
const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
  if (!textareaRef.current) return;
  
  const textarea = textareaRef.current;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = content.slice(start, end);
  
  const formatMap = {
    bold: { prefix: '**', suffix: '**' },
    italic: { prefix: '_', suffix: '_' },
    underline: { prefix: '~', suffix: '~' }
  };
  
  const { prefix, suffix } = formatMap[format];
  
  let newContent: string;
  let newCursorPos: number;
  
  if (selectedText.length > 0) {
    // Wrap selezione con Markdown
    newContent = 
      content.slice(0, start) + 
      prefix + selectedText + suffix + 
      content.slice(end);
    newCursorPos = end + prefix.length + suffix.length;
  } else {
    // Inserisci markers vuoti e posiziona cursore al centro
    newContent = 
      content.slice(0, start) + 
      prefix + suffix + 
      content.slice(end);
    newCursorPos = start + prefix.length;
  }
  
  setContent(newContent);
  
  // Ripristina focus e posizione cursore
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  });
};
```

**Passaggio prop a MediaActionBar (linea ~1543-1548):**
```tsx
<MediaActionBar
  onFilesSelected={handleMediaSelect}
  disabled={isUploading || isLoading}
  characterCount={content.length}
  maxCharacters={3000}
  onFormat={applyFormatting}  // NEW
/>
```

---

## Mappatura Markdown Finale

| Pulsante | Formato Markdown | Esempio Output |
|----------|------------------|----------------|
| **B** (Bold) | `**testo**` | `**importante**` |
| **I** (Italic) | `_testo_` | `_enfasi_` |
| **U** (Underline) | `~testo~` | `~sottolineato~` |

---

## Garanzie Zero-Regressione

| Funzionalità | Status |
|--------------|--------|
| `handlePublish` | ✅ Non modificata |
| `loadPreview` | ✅ Non modificata |
| URL detection regex | ✅ Non modificato |
| Comprehension Gate | ✅ Intatto |
| OCR/Trascrizione flow | ✅ Intatto |
| Character counter | ✅ Include simboli Markdown |
| Mention dropdown | ✅ Invariato |

---

## Struttura Toolbar Finale

```text
+------------------------------------------------------------------+
|  [B]  [I]  [U]    |    [📷 Camera]  [🖼 Galleria]  [📎 File]  123/3000
+------------------------------------------------------------------+
```

---

## Test Consigliati Post-Implementazione

1. **Formattazione Bold**: Selezionare testo → premere B → verificare `**testo**`
2. **Formattazione Italic senza selezione**: Premere I → verificare `__` con cursore al centro
3. **Conteggio caratteri**: Verificare che includa i simboli Markdown
4. **Camera su mobile**: Verificare apertura diretta fotocamera
5. **Galleria**: Verificare apertura picker con foto E video
6. **Plus (File)**: Verificare apertura file picker generico
7. **Gate URL**: Incollare URL → verificare che il Comprehension Gate funzioni
8. **Mention**: Digitare `@utente` → verificare dropdown
