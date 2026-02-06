
# Piano: Sistema Adaptive Content Multi-Livello

## Stato Attuale

Ho analizzato il codice e identificato la logica esistente:

- **Overflow Detection**: Esiste già un `ResizeObserver` collegato a `contentZoneRef` che misura `scrollHeight > clientHeight` e setta `isOverflowing`
- **Risposta Attuale**: Solo `MediaGallery` riceve `imageMaxHeightClass={isOverflowing ? "max-h-[20vh]" : undefined}`
- **Problema**: La riduzione immagine da sola non basta per contenuti densi (reshare, testi lunghi, quoted posts)

## Nuova Architettura: "Adaptive Content Levels"

Invece di un singolo boolean, implemento un sistema a **4 livelli progressivi** che reagisce proporzionalmente all'overflow:

```text
+-------------------+     +-------------------+     +-------------------+     +-------------------+
|   LEVEL 0         | --> |   LEVEL 1         | --> |   LEVEL 2         | --> |   LEVEL 3         |
|   (Default)       |     |   (Light Compact) |     |   (Medium)        |     |   (Aggressive)    |
+-------------------+     +-------------------+     +-------------------+     +-------------------+
|   No overflow     |     |   Overflow < 20%  |     |   Overflow 20-40% |     |   Overflow > 40%  |
|   gap-4, text-lg  |     |   gap-3, text-lg  |     |   gap-2, text-base|     |   gap-2, text-sm  |
|   No clamp change |     |   padding py-4    |     |   max-h-[25vh]    |     |   max-h-[20vh]    |
|                   |     |                   |     |   line-clamp-4    |     |   line-clamp-2/3  |
+-------------------+     +-------------------+     +-------------------+     +-------------------+
```

## Gerarchia di Riduzione (come richiesto)

1. **Step 1 - Gap/Padding**: `gap-4 → gap-3 → gap-2` + `py-6 → py-4`
2. **Step 2 - Typography**: `text-lg → text-base → text-sm` + `leading-snug → leading-tight`
3. **Step 3 - Media**: `(nessun limite) → max-h-[25vh] → max-h-[20vh]`
4. **Step 4 - Line Clamp**: `line-clamp-6 → line-clamp-4 → line-clamp-2/3`

## Modifiche Dettagliate

### 1. ImmersivePostCard.tsx - Nuovo Sistema di Livelli

**A) Sostituire `isOverflowing: boolean` con `overflowLevel: 0|1|2|3`**

Nella sezione hook (~linea 344):

```tsx
// DA:
const [isOverflowing, setIsOverflowing] = useState(false);

// A:
const [overflowLevel, setOverflowLevel] = useState<0 | 1 | 2 | 3>(0);
```

**B) Calcolo Livello nel ResizeObserver**

```tsx
const checkOverflow = () => {
  const scrollH = el.scrollHeight;
  const clientH = el.clientHeight;
  
  if (scrollH <= clientH + 1) {
    setOverflowLevel(0); // No overflow
  } else {
    const overflowRatio = (scrollH - clientH) / clientH;
    if (overflowRatio < 0.15) {
      setOverflowLevel(1); // Light: < 15%
    } else if (overflowRatio < 0.35) {
      setOverflowLevel(2); // Medium: 15-35%
    } else {
      setOverflowLevel(3); // Aggressive: > 35%
    }
  }
};
```

**C) Content Zone - Gap e Padding Adattivi**

```tsx
// DA:
className="relative z-10 flex-1 flex flex-col justify-center px-2 py-6 min-h-0 overflow-hidden"

// A:
className={cn(
  "relative z-10 flex-1 flex flex-col justify-center px-2 min-h-0 overflow-hidden",
  overflowLevel === 0 && "gap-4 py-6",
  overflowLevel === 1 && "gap-3 py-4",
  overflowLevel >= 2 && "gap-2 py-3"
)}
```

**D) Testo Principale - Typography Fluida (~linea 1368)**

```tsx
// DA:
className="text-[clamp(1rem,3.5vw,1.25rem)] font-normal text-white/90 leading-snug..."

// A:
className={cn(
  "font-normal text-white/90 drop-shadow-md mb-3 sm:mb-4",
  // Typography Level
  overflowLevel === 0 && "text-lg leading-snug tracking-wide",
  overflowLevel === 1 && "text-base leading-snug tracking-wide",
  overflowLevel >= 2 && "text-sm leading-tight tracking-normal",
  // Line Clamp Level
  overflowLevel <= 1 && "line-clamp-6 [@media(min-height:900px)]:line-clamp-8",
  overflowLevel === 2 && "line-clamp-4",
  overflowLevel === 3 && "line-clamp-3"
)}
```

**E) MediaGallery - Image Height Adattivo**

```tsx
// DA:
imageMaxHeightClass={isOverflowing ? "max-h-[20vh]" : undefined}

// A:
imageMaxHeightClass={
  overflowLevel === 0 ? undefined :
  overflowLevel === 1 ? undefined :
  overflowLevel === 2 ? "max-h-[25vh]" :
  "max-h-[20vh]"
}
```

**F) Text-Only Cards (~linea 1464) - Typography Adattiva**

```tsx
// DA:
className="text-[17px] sm:text-lg font-normal text-white/95 leading-[1.65]..."

// A:
className={cn(
  "font-normal text-white/95 whitespace-pre-wrap",
  overflowLevel <= 1 && "text-[17px] sm:text-lg leading-[1.65] tracking-[0.01em]",
  overflowLevel >= 2 && "text-sm leading-snug tracking-normal"
)}
```

**G) Link Preview Title (~linea 1934) - Typography Adattiva**

```tsx
// DA:
className="text-lg font-medium text-white/90 leading-relaxed..."

// A:
className={cn(
  "font-medium text-white/90 drop-shadow-lg",
  overflowLevel <= 1 && "text-lg leading-relaxed line-clamp-3",
  overflowLevel >= 2 && "text-base leading-snug line-clamp-2"
)}
```

**H) Quoted Post Wrapper (~linea 2041) - Margine Responsivo**

```tsx
// DA:
className="mt-8 rounded-xl"

// A:
className={cn(
  "rounded-xl",
  overflowLevel <= 1 && "mt-8",
  overflowLevel >= 2 && "mt-4"
)}
```

### 2. ImmersiveFocusCard.tsx - Stesso Sistema

**A) Aggiungere overflowLevel**

Aggiungere il medesimo sistema di detection (ref + ResizeObserver + overflowLevel) che è già in ImmersivePostCard.

**B) Content Zone con Gap Adattivi**

```tsx
className={cn(
  "relative z-10 flex-1 flex flex-col justify-center px-2 min-h-0 overflow-hidden",
  overflowLevel === 0 && "gap-4 py-6",
  overflowLevel === 1 && "gap-3 py-4",
  overflowLevel >= 2 && "gap-2 py-3"
)}
```

**C) Titolo e Summary con Typography Fluida**

```tsx
// Titolo
className={cn(
  "font-bold text-white leading-tight mb-4 drop-shadow-xl",
  overflowLevel <= 1 && "text-3xl",
  overflowLevel >= 2 && "text-2xl"
)}

// Summary
className={cn(
  "text-white/80 leading-relaxed mb-6",
  overflowLevel === 0 && "text-lg line-clamp-6",
  overflowLevel === 1 && "text-base line-clamp-5",
  overflowLevel >= 2 && "text-sm leading-snug line-clamp-4"
)}
```

### 3. Protezione Layer (Mantenimento)

Le modifiche precedenti rimangono in vigore:
- Header e Action Bar: `relative z-20`
- Content Zone: `relative z-10`
- Gradiente protettivo `h-32` dietro Action Bar

## File Coinvolti

1. `src/components/feed/ImmersivePostCard.tsx`
   - Nuovo sistema `overflowLevel` con calcolo proporzionale
   - Gap/padding adattivi nel Content Zone
   - Typography fluida per tutti i testi
   - Line-clamp dinamici
   - Margini responsive per quoted posts

2. `src/components/feed/ImmersiveFocusCard.tsx`
   - Stesso sistema `overflowLevel`
   - Gap/padding adattivi
   - Typography fluida per titolo e summary

## Comportamento Atteso

| Scenario | Level | Risposta |
|----------|-------|----------|
| Post corto con media piccolo | 0 | Layout normale, nessuna compressione |
| Post medio con media | 1 | Gap ridotti (gap-3), padding ridotti (py-4) |
| Reshare con quoted + media | 2 | Gap minimi (gap-2), font base, immagine max-h-[25vh], line-clamp-4 |
| Reshare complesso con tanto testo | 3 | Font small, leading tight, immagine max-h-[20vh], line-clamp-2/3 |

## Dettagli Tecnici

### Perche Livelli vs Boolean

Un boolean (`isOverflowing`) ha solo 2 stati: "tutto bene" o "riduci tutto". Non permette graduazioni.

Con 4 livelli, la risposta e proporzionale:
- Overflow minimo = piccoli aggiustamenti di spacing
- Overflow moderato = font ridotto + immagine compressa
- Overflow grave = tutto al minimo per forzare la visibilita

### Perche Ratio-Based

Il calcolo `(scrollHeight - clientHeight) / clientHeight` da una percentuale di overflow:
- 10% = il contenuto e appena piu grande del container
- 50% = il contenuto e meta piu grande

Questo permette soglie prevedibili e testabili.

### Transizioni CSS

Per evitare "salti" visivi quando il livello cambia, le classi devono avere transizioni soft. In futuro si puo aggiungere:

```css
.content-zone {
  transition: gap 150ms ease-out, padding 150ms ease-out;
}
```

Ma per ora, l'approccio senza transizione e piu stabile (evita flickering durante il resize).
