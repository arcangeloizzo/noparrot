
# Fix Strutturale Sistema Reazioni Estese

## Problema Identificato

Il sistema di reazioni estese presenta tre categorie di problemi:

1. **Posizionamento Picker**: Il picker centrato al 50% esce fuori schermo su dispositivi con viewport ridotti
2. **Touch UX**: Lo shield intercetta erroneamente il rilascio del dito dopo long-press, causando chiusure immediate
3. **Persistenza**: Le reazioni selezionate non vengono salvate correttamente quando l'utente cambia emoji

## Stato Attuale del Codice

### Analisi Database
I CHECK CONSTRAINT sono **già correttamente configurati**:
- `reactions`: `CHECK (reaction_type = ANY (ARRAY['heart', 'bookmark', 'laugh', 'wow', 'sad', 'fire']))`
- `focus_reactions`: Stesso vincolo presente

### Analisi Hooks
La logica di switch in `usePosts.ts` e `useFocusReactions.ts` è **già implementata correttamente**:
- Verifica se esiste una reazione precedente
- Se il tipo è diverso, esegue UPDATE invece di INSERT
- Il conteggio esclude già i bookmark

### CSS Action Bar Zone
La classe `.action-bar-zone` esiste già in `index.css` con tutte le proprietà necessarie.

## Soluzione Proposta

### 1. Fix Posizionamento Picker (Viewport Aware)

Modificherò `reaction-picker.tsx` per:
- Usare posizionamento safe con margini laterali garantiti
- Calcolare dinamicamente la posizione left per evitare overflow
- Aggiungere `max-width` e centratura safe

### 2. Fix Shield Touch Flow

Correggerò la gestione dello shield in `reaction-picker.tsx`:
- Il `touchend` sullo shield NON deve chiudere durante `isInteracting`
- Aggiungere delay separato per evitare che il rilascio del long-press triggeri la chiusura
- Usare `onPointerUp` invece di `onTouchEnd` per gestione più robusta

### 3. Estendere Touch Isolation ai Container Parent

Applicherò la classe `action-bar-zone` anche ai container parent dei pulsanti per garantire isolamento completo del tocco.

---

## Sezione Tecnica

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/ui/reaction-picker.tsx` | Fix posizionamento viewport-aware + fix shield touch flow |
| `src/components/feed/CommentItem.tsx` | Estendere isolation ai pulsanti singoli |
| `src/components/feed/ImmersivePostCard.tsx` | Verificare action-bar-zone applicata correttamente |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Verificare action-bar-zone applicata correttamente |

### Fix 1: Posizionamento Viewport-Aware

```typescript
// reaction-picker.tsx - Nuovo posizionamento
const containerRef = React.useRef<HTMLDivElement>(null);
const [positionStyle, setPositionStyle] = React.useState<React.CSSProperties>({
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '8px'
});

React.useEffect(() => {
  if (!isOpen || !containerRef.current) return;
  
  const container = containerRef.current;
  const rect = container.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const pickerWidth = 240; // 5 emoji × 40px + padding
  const safeMargin = 12;
  
  // Calcola posizione left sicura
  let idealLeft = rect.left + rect.width / 2 - pickerWidth / 2;
  
  // Clamp ai margini
  if (idealLeft < safeMargin) {
    idealLeft = safeMargin;
  } else if (idealLeft + pickerWidth > viewportWidth - safeMargin) {
    idealLeft = viewportWidth - pickerWidth - safeMargin;
  }
  
  setPositionStyle({
    bottom: '100%',
    left: `${idealLeft}px`,
    marginBottom: '8px',
    position: 'fixed',
    transform: 'none'
  });
}, [isOpen]);
```

### Fix 2: Shield Touch Flow Robusto

```typescript
// reaction-picker.tsx - Shield handler migliorato
const handleShieldInteraction = (e: React.MouseEvent | React.TouchEvent) => {
  e.stopPropagation();
  e.preventDefault();
  
  // NON chiudere se:
  // 1. Siamo nella finestra di interazione iniziale (long-press release)
  // 2. L'evento è un touchend (potrebbe essere rilascio long-press)
  const isTouchEnd = e.type === 'touchend';
  
  if (isInteracting) {
    // Ignora completamente durante la finestra di protezione
    return;
  }
  
  if (isTouchEnd) {
    // Per touchend, aspetta un frame prima di decidere
    requestAnimationFrame(() => {
      if (!isInteracting) {
        onClose();
      }
    });
    return;
  }
  
  // Click mouse: chiudi immediatamente
  onClose();
};
```

### Fix 3: Touch Isolation Completa

```tsx
// CommentItem.tsx - Aggiungere select-none ai pulsanti singoli
<div className="flex items-center gap-1 action-bar-zone">
  <button
    className={cn(
      "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full select-none",
      "-webkit-tap-highlight-color: transparent"
    )}
    style={{ 
      WebkitTapHighlightColor: 'transparent',
      WebkitUserSelect: 'none'
    }}
    {...likeButtonHandlers}
  >
```

### Cambio Stile Picker

```tsx
// reaction-picker.tsx - Container con max-width e centratura safe
<div
  ref={containerRef}
  className={cn(
    "z-50 flex items-center gap-1 px-2 py-1.5",
    "bg-popover/95 backdrop-blur-xl border border-border/50",
    "rounded-full shadow-2xl",
    "animate-in fade-in-0 zoom-in-95 duration-200",
    className
  )}
  style={positionStyle}
>
```

---

## Risultato Atteso

1. **Picker sempre visibile**: Le emoji non escono mai fuori schermo, con margini garantiti di 12px
2. **Nessuna macchia blu**: Touch isolation completa su tutta l'action bar
3. **Nessuna chiusura accidentale**: Lo shield ignora i touchend durante la finestra di protezione di 350ms
4. **Reazioni persistenti**: Il database e gli hook gestiscono correttamente lo switch tra emoji
5. **Colore cuore conservato**: `text-destructive` per heart attivo rimane invariato

## Considerazioni Safe Guard

- Il flusso Comprehension Gate non viene toccato
- Le RLS policy rimangono invariate
- I CHECK constraint esistenti sono già corretti
- La logica di persistenza negli hook è già funzionante
