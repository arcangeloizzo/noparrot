
# Fix Posizionamento Picker e Text Selection

## Problemi Identificati

### 1. Picker posizionato sotto il commento (invisibile)
Il `ReactionPicker` calcola il `bottom` per posizionarsi **sopra** il bottone, ma se il commento è vicino al top dello schermo (es. un solo commento), non c'è spazio e il picker viene tagliato o posizionato fuori viewport.

**Causa**: Il calcolo attuale usa solo `bottom: window.innerHeight - rect.top + 8` senza verificare se c'è spazio sopra. Se non c'è spazio, dovrebbe posizionarsi **sotto** il bottone.

### 2. Selezione testo durante long-press
L'utente vede ancora la selezione del testo ("macchie blu") durante il long-press perché:
- L'hook `useLongPress` non chiama `e.preventDefault()` nel `onTouchStart`
- I button nel `CommentsDrawer` non hanno le proprietà CSS anti-selezione

## Soluzione Proposta

### Fix 1: Posizionamento Adattivo (Flip Up/Down)

Modificherò `reaction-picker.tsx` per:
- Verificare se c'è abbastanza spazio sopra il bottone (min 60px per il picker)
- Se non c'è spazio sopra, posizionare il picker **sotto** il bottone
- Usare `top` invece di `bottom` quando si flippa

### Fix 2: Prevenzione Selezione Testo

Modificherò:
- `useLongPress.ts`: Aggiungere `e.preventDefault()` nel `onTouchStart` per bloccare la selezione immediatamente
- `CommentsDrawer.tsx`: Aggiungere classi `action-bar-zone` e stili inline sui button delle reazioni

---

## Sezione Tecnica

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/ui/reaction-picker.tsx` | Logica flip up/down basata su spazio disponibile |
| `src/hooks/useLongPress.ts` | `e.preventDefault()` nel `onTouchStart` |
| `src/components/feed/CommentsDrawer.tsx` | Touch isolation sui button azioni |

### Fix 1: Posizionamento con Flip

```typescript
// reaction-picker.tsx - useEffect per calcolo posizione
React.useEffect(() => {
  if (!isOpen || !wrapperRef.current) return;
  
  const wrapper = wrapperRef.current;
  const rect = wrapper.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const pickerWidth = 240;
  const pickerHeight = 52; // Altezza picker con emoji
  const safeMargin = 12;
  const minSpaceAbove = pickerHeight + 16; // Spazio minimo sopra per mostrare il picker
  
  // Calcolo X (left) - già implementato
  let idealLeft = rect.left + rect.width / 2 - pickerWidth / 2;
  if (idealLeft < safeMargin) {
    idealLeft = safeMargin;
  } else if (idealLeft + pickerWidth > viewportWidth - safeMargin) {
    idealLeft = viewportWidth - pickerWidth - safeMargin;
  }
  
  // Calcolo Y (flip logic)
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  
  // Se non c'è abbastanza spazio sopra, mostra sotto
  const showBelow = spaceAbove < minSpaceAbove && spaceBelow > minSpaceAbove;
  
  if (showBelow) {
    setPositionStyle({
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${idealLeft}px`,
      transform: 'none',
    });
  } else {
    setPositionStyle({
      position: 'fixed',
      bottom: `${viewportHeight - rect.top + 8}px`,
      left: `${idealLeft}px`,
      transform: 'none',
    });
  }
}, [isOpen]);
```

### Fix 2: preventDefault in useLongPress

```typescript
// useLongPress.ts - onTouchStart
onTouchStart: (e: React.TouchEvent) => {
  // CRITICAL: Previene la selezione testo su iOS durante long-press
  e.preventDefault();
  const touch = e.touches[0];
  start(touch.clientX, touch.clientY);
},
```

### Fix 3: Touch Isolation in CommentsDrawer

```tsx
// CommentsDrawer.tsx - CommentItem, linea 1001-1028
<div className="flex items-center gap-4 mt-2 action-bar-zone">
  <div className="relative">
    <button
      {...likeHandlers}
      className="flex items-center gap-1.5 text-xs ... select-none"
      style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none' }}
    >
```

---

## Risultato Atteso

1. **Picker sempre visibile**: Se non c'è spazio sopra, il picker appare sotto il bottone
2. **Nessuna selezione testo**: Il `preventDefault()` blocca iOS dal selezionare durante il touch
3. **Nessuna macchia blu**: Le proprietà CSS eliminano l'highlight nativo

## Componenti Impattati

Il fix si applica automaticamente a tutti i punti che usano `ReactionPicker` e `useLongPress`:
- `CommentsDrawer` (Comments nel Drawer)
- `CommentItem` (src/components/feed/CommentItem.tsx)
- `ImmersivePostCard` (Feed principale)
- `ImmersiveEditorialCarousel` (Il Punto)

## Safe Guard

- Il flusso Comprehension Gate rimane invariato
- Le RLS policies non vengono toccate
- Il comportamento del tap normale (non long-press) rimane identico
