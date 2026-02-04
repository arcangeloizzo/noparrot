
# Piano: Drag-to-Select per Enhanced Reactions

## Obiettivo
Cambiare il flusso di selezione reazioni da "long press → rilascio → tap su emoji" a "long press → drag tenendo premuto → rilascio per selezionare".

## Comportamento attuale
1. Utente tiene premuto sull'icona cuore
2. Dopo 500ms appare il picker
3. Utente rilascia il dito
4. Utente clicca sull'emoji desiderata
5. Reazione applicata

## Nuovo comportamento
1. Utente tiene premuto sull'icona cuore
2. Dopo 500ms appare il picker (haptic feedback)
3. SENZA rilasciare, l'utente scorre il dito sulle emoji
4. Quando il dito passa sopra un'emoji, questa si ingrandisce (scale-150)
5. L'utente rilascia il dito sull'emoji desiderata
6. Reazione applicata

## Componenti coinvolti

| Componente | Modifica |
|------------|----------|
| `useLongPress.ts` | Aggiungere callback `onMove` e `onRelease` per tracciare il drag |
| `ReactionPicker.tsx` | Tracciare posizione dito e gestire hover/selezione al rilascio |
| `CommentItem.tsx` | Passare i nuovi handler al like button |
| `ImmersivePostCard.tsx` | Passare i nuovi handler al like button |

## Dettagli tecnici

### 1. Modifica `useLongPress.ts`

Aggiungere nuove callback per il drag:

```typescript
export interface UseLongPressOptions {
  onLongPress: () => void;
  onTap?: () => void;
  onMove?: (x: number, y: number) => void;  // NEW: drag position
  onRelease?: () => void;  // NEW: called when touch ends AFTER long press triggered
  threshold?: number;
  disableHaptic?: boolean;
}
```

Il hook deve:
- Chiamare `onMove` su ogni `touchmove` DOPO che il long press e stato attivato
- Chiamare `onRelease` su `touchend` SOLO se il long press era stato attivato
- NON chiamare `onTap` se il long press era stato attivato

### 2. Modifica `ReactionPicker.tsx`

Aggiungere:
- Stato `hoveredReaction` per tracciare quale emoji e sotto il dito
- Funzione `updateHoveredReaction(x, y)` che usa `document.elementFromPoint`
- Gestire `onTouchEnd` globale per selezionare l'emoji hovered

```typescript
// Nuovo stato
const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);

// Funzione per aggiornare hover basata su coordinate
const updateHoveredReaction = useCallback((x: number, y: number) => {
  const element = document.elementFromPoint(x, y);
  const reactionButton = element?.closest('[data-reaction-type]');
  if (reactionButton) {
    const type = reactionButton.getAttribute('data-reaction-type') as ReactionType;
    setHoveredReaction(type);
  } else {
    setHoveredReaction(null);
  }
}, []);

// Nuova prop per ricevere coordinate dal parent
interface ReactionPickerProps {
  // ... existing props
  onDragMove?: (x: number, y: number) => void;  // Passato dal parent
}
```

I bottoni delle emoji avranno:
- `data-reaction-type="heart"` per identificazione
- Classe condizionale `scale-150` quando `hoveredReaction === type`

### 3. Nuove props per ReactionPicker

```typescript
interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reactionType: ReactionType) => void;
  currentReaction?: ReactionType | null;
  triggerRef?: React.RefObject<HTMLElement>;
  className?: string;
  // NEW: for drag-to-select
  dragPosition?: { x: number; y: number } | null;
  onDragRelease?: () => void;
}
```

### 4. Integrazione in CommentItem e ImmersivePostCard

```typescript
// Stato per drag position
const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

const likeButtonHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => handleLike('heart'),
  onMove: (x, y) => setDragPosition({ x, y }),
  onRelease: () => setDragPosition(null),
});

<ReactionPicker
  isOpen={showReactionPicker}
  onClose={() => setShowReactionPicker(false)}
  onSelect={(type) => {
    handleLike(type);
    setShowReactionPicker(false);
  }}
  currentReaction={reactions?.myReactionType}
  triggerRef={likeButtonRef}
  dragPosition={dragPosition}
  onDragRelease={() => {
    // La selezione avviene internamente al picker basata su hoveredReaction
    setDragPosition(null);
  }}
/>
```

## Flusso eventi

```text
[touchstart] -> start timer
       |
[500ms] -> trigger onLongPress -> picker opens -> haptic
       |
[touchmove] -> onMove(x, y) -> picker.updateHoveredReaction(x, y)
       |                              |
       |                        [emoji hovered] -> scale-150 + haptic.selection
       |
[touchend] -> onRelease -> picker selects hoveredReaction if any
                                   |
                            [no hovered] -> just close
                            [hovered] -> onSelect(type) + close
```

## Visual feedback

Emoji buttons:
- Default: `scale-100`
- Hovered (dito sopra): `scale-150` + leggero haptic
- Transizione: `transition-transform duration-100`

## File da modificare

| File | Linee | Modifica |
|------|-------|----------|
| `src/hooks/useLongPress.ts` | Tutto | Aggiungere onMove, onRelease, gestione touchmove |
| `src/components/ui/reaction-picker.tsx` | Tutto | Aggiungere drag-to-select logic |
| `src/components/feed/CommentItem.tsx` | 142-145, 345-355 | Passare nuove props al picker |
| `src/components/feed/ImmersivePostCard.tsx` | 478-481, 2095-2104 | Passare nuove props al picker |

## Impatto su altri flussi

| Componente | Impatto |
|------------|---------|
| Comprehension Gate | Nessuno - logica separata |
| Commenti flow | Nessuno - solo UX delle reazioni cambia |
| FocusCard likes | Nessuno - non usa enhanced reactions |
| MediaViewer | Nessuno - usa action bar diversa |

## Note implementative

1. `document.elementFromPoint()` funziona bene su iOS Safari
2. Il picker deve avere `pointer-events-auto` per essere rilevato
3. Lo shield (z-9998) non deve intercettare gli eventi durante il drag
4. Usare `data-reaction-type` attributi per identificare le emoji

## Test di validazione

1. Long press sul cuore in un commento
2. Senza rilasciare, spostare il dito sulle emoji
3. Verificare che l'emoji sotto il dito si ingrandisca
4. Rilasciare il dito su un'emoji
5. Verificare che la reazione venga applicata
6. Ripetere su ImmersivePostCard
7. Testare anche il tap singolo (deve ancora funzionare per like rapido)
