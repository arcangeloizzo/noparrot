
# Piano di Correzione: Toolbar iOS e Semplificazione Media Actions

## Problema Identificato

### 1. Toolbar coperta dalla tastiera (iOS Safari/PWA)
Su Safari iOS, `position: absolute` con `100dvh` **non basta**. Il visualViewport di iOS non spinge automaticamente elementi non-fixed. L'unica soluzione affidabile è usare `visualViewport.resize` per calcolare manualmente l'offset della tastiera.

### 2. Menu nativo iOS per input file
Quando un `<input type="file" accept="image/*,video/*">` viene attivato su iOS, il sistema **mostra sempre un action sheet nativo** ("Scatta foto", "Fotocamera", "Libreria foto") - non è controllabile dall'app. L'unica alternativa è separare gli input (solo immagini OPPURE solo video).

---

## Soluzione Proposta

### Parte A: Tornare a Fotocamera + Dropdown (come richiesto)

Come da tua richiesta, semplificheremo la MediaActionBar:

- **Icona Camera**: Azione diretta → Apre fotocamera per scatto/registrazione
- **Icona Plus (+)**: Apre un dropdown custom con opzioni:
  - Galleria Foto
  - Galleria Video  
  - File/Documenti

Questo elimina il menu nativo iOS perché ogni input avrà un solo tipo di accept.

```text
+------------------------------------------------------------------+
|  [B]  [I]  [U]    |    [📷 Camera]  [+ Menu]               123/3000
+------------------------------------------------------------------+
                              ↓
                     ┌─────────────────┐
                     │ 🖼 Foto         │
                     │ 🎬 Video        │
                     │ 📎 File         │
                     └─────────────────┘
```

### Parte B: Fix Toolbar iOS con visualViewport API

Implementeremo un listener su `window.visualViewport` per calcolare dinamicamente il `bottom` della toolbar quando la tastiera è aperta:

```tsx
// In ComposerModal.tsx
const [keyboardOffset, setKeyboardOffset] = useState(0);

useEffect(() => {
  if (!isOpen) return;
  
  const viewport = window.visualViewport;
  if (!viewport) return;
  
  const handleResize = () => {
    // Calcola quanto spazio la tastiera sta occupando
    const offset = window.innerHeight - viewport.height;
    setKeyboardOffset(offset > 50 ? offset : 0);
  };
  
  viewport.addEventListener('resize', handleResize);
  viewport.addEventListener('scroll', handleResize);
  
  return () => {
    viewport.removeEventListener('resize', handleResize);
    viewport.removeEventListener('scroll', handleResize);
  };
}, [isOpen]);
```

La MediaActionBar userà questo offset per posizionarsi sopra la tastiera:

```tsx
<MediaActionBar
  style={{ transform: `translateY(-${keyboardOffset}px)` }}
  // oppure
  style={{ bottom: keyboardOffset }}
/>
```

---

## Dettagli Tecnici

### MediaActionBar.tsx - Modifiche

1. **Rimuovere** le 3 icone separate (Camera, Image, FileText)
2. **Aggiungere** stato `showMediaMenu` per il dropdown
3. **Creare dropdown** con 3 opzioni (Foto, Video, File)
4. **Mantenere** 3 input nascosti con accept specifici:
   - `cameraInput`: `accept="image/*,video/*" capture="environment"` (scatto diretto)
   - `photoInput`: `accept="image/*" multiple` (solo foto da galleria)
   - `videoInput`: `accept="video/*"` (solo video da galleria)
   - `fileInput`: `accept="*/*"` (documenti)

### ComposerModal.tsx - Modifiche

1. **Aggiungere** hook `useVisualViewportOffset()` per iOS keyboard detection
2. **Modificare** layout: toolbar con `position: sticky` + `bottom: offset`
3. **Fallback**: Se visualViewport non disponibile, usa CSS `100dvh` come backup

---

## File da Modificare

| File | Azione |
|------|--------|
| `src/components/composer/MediaActionBar.tsx` | Refactoring completo con dropdown |
| `src/components/composer/ComposerModal.tsx` | Aggiunta visualViewport listener + sticky toolbar |

---

## Garanzie Zero-Regressione

| Funzionalità | Status |
|--------------|--------|
| Tiptap Editor | Non toccato |
| Comprehension Gate | Non toccato |
| Formattazione B/I/U | Mantenuta |
| Character counter | Mantenuto |
| OCR/Trascrizione | Non toccato |
| Menzioni floating | Non toccate |

---

## Risultato Atteso

1. Su iOS Safari/PWA: la toolbar sale sopra la tastiera
2. Click su Camera: apre direttamente la fotocamera (nessun menu)
3. Click su Plus: apre un dropdown app-styled con 3 opzioni chiare
4. Ogni opzione del dropdown apre direttamente il picker corretto (nessun menu nativo intermedio)
