

# Piano: Layout Adattivo Definitivo per Card Immersive

## Diagnosi Attuale

Ho analizzato il codice e identificato le cause precise dei problemi:

### Problemi Strutturali
1. **Padding Duplicati**: Il container esterno ha `p-6` (24px su tutti i lati) + il Content Layer interno ha `pt-10 pb-20`. Questo **somma 24px + 40px = 64px sopra** e **24px + 80px = 104px sotto**.
2. **Contenuto Centrato**: Il Content Zone usa `justify-center`, che spinge il contenuto al centro lasciando vuoti sopra e sotto.
3. **Taglio Brutale**: `overflow-hidden` sul wrapper centrale taglia tutto senza permettere adattamento.
4. **Media Non Responsivo**: Le immagini hanno `max-h-[45vh]` fisso che non si adatta agli schermi piccoli.

### File Interessati
- `src/components/feed/ImmersivePostCard.tsx` (linee 1150, 1223, 1333)
- `src/components/feed/ImmersiveFocusCard.tsx` (linee 85, 104, 216)
- `src/components/media/MediaGallery.tsx` (linee 87, 142)

---

## Soluzione: Layout Adattivo con Budget Proporzionale

### Principio
Invece di tagliare, **redistribuiamo proporzionalmente** lo spazio tra header, contenuto e action bar usando:
- Padding calcolati con `env(safe-area-inset-*)` per gli spazi di sistema
- `justify-start` con `gap` controllato invece di `justify-center`
- Budget di altezza responsivi per media (più piccoli su schermi bassi)
- Font fluidi con `clamp()` e `line-clamp` dinamici per altezza viewport

---

## Modifiche Dettagliate

### 1. ImmersivePostCard.tsx

**A) Container Esterno (linea ~1150)**
Rimuovere il padding verticale esterno, mantenere solo quello orizzontale:
```tsx
// DA:
className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden"

// A:
className="h-[100dvh] w-full snap-start relative flex flex-col px-4 overflow-hidden"
```

**B) Content Layer (linea ~1223)**
Usare padding calcolati basati sulle safe area + altezze fisse di header/navbar:
```tsx
// DA:
className="relative z-10 w-full h-full flex flex-col pt-10 pb-20 sm:pb-24"

// A:
className="relative z-10 w-full h-full flex flex-col pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)]"
```
- `3.5rem` = 56px per l'header dell'app
- `5rem` = 80px per navbar (64px) + margine di sicurezza

**C) Content Zone (linea ~1333)**
Passare da `justify-center` a `justify-start` e rimuovere `overflow-hidden`:
```tsx
// DA:
className="flex-1 flex flex-col justify-center px-2 pt-2 sm:pt-2 min-h-0 overflow-hidden"

// A:
className="flex-1 flex flex-col justify-start gap-4 px-2 pt-4 min-h-0"
```

**D) Testo Principale - Font Fluido (linea ~1338)**
Usare `clamp()` per font-size e `line-clamp` dinamico per altezza:
```tsx
// DA:
className="text-base sm:text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-3 sm:mb-4 line-clamp-4"

// A:
className="text-[clamp(1rem,3.5vw,1.25rem)] font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-3 sm:mb-4 line-clamp-4 [@media(min-height:780px)]:line-clamp-6 [@media(min-height:900px)]:line-clamp-8"
```

**E) Quoted Post Wrapper (linea ~2009)**
Aggiungere budget responsivo invece di taglio fisso:
```tsx
// DA:
className="mt-4 max-h-[40vh] overflow-hidden rounded-xl"

// A:
className="mt-4 max-h-[min(35vh,280px)] [@media(min-height:780px)]:max-h-[min(40vh,360px)] overflow-hidden rounded-xl"
```

### 2. ImmersiveFocusCard.tsx

**A) Container Esterno (linea ~85)**
```tsx
// DA:
className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden cursor-pointer"

// A:
className="h-[100dvh] w-full snap-start relative flex flex-col px-4 overflow-hidden cursor-pointer"
```

**B) Content Layer (linea ~104)**
```tsx
// DA:
className="relative z-10 w-full h-full flex flex-col pt-10 pb-20 sm:pb-24"

// A:
className="relative z-10 w-full h-full flex flex-col pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)]"
```

**C) Content Zone (linea ~216)**
```tsx
// DA:
className="flex-1 flex flex-col justify-center px-2 min-h-0 overflow-hidden"

// A:
className="flex-1 flex flex-col justify-start gap-4 px-2 pt-4 min-h-0"
```

**D) Titolo Focus - Font Fluido (linea ~218)**
```tsx
// DA:
className="text-3xl font-bold text-white leading-tight mb-4 drop-shadow-xl"

// A:
className="text-[clamp(1.5rem,5vw,2rem)] font-bold text-white leading-tight mb-4 drop-shadow-xl"
```

**E) Summary Focus - Line Clamp Dinamico (linea ~221)**
```tsx
// DA:
className="text-lg text-white/80 leading-relaxed line-clamp-4 mb-6"

// A:
className="text-[clamp(1rem,3.5vw,1.125rem)] text-white/80 leading-relaxed line-clamp-4 [@media(min-height:780px)]:line-clamp-6 mb-6"
```

### 3. MediaGallery.tsx

**A) Immagine Singola (linea ~87)**
Budget responsivo con cap in pixel:
```tsx
// DA:
className="w-full aspect-auto max-h-[45vh] object-contain bg-black/40"

// A:
className="w-full aspect-auto max-h-[min(30vh,240px)] [@media(min-height:780px)]:max-h-[min(40vh,360px)] [@media(min-height:900px)]:max-h-[min(45vh,420px)] object-contain bg-black/40"
```

**B) Immagini Carousel (linea ~142)**
Stessa logica:
```tsx
// DA:
className="w-full aspect-auto max-h-[45vh] object-contain bg-black/40"

// A:
className="w-full aspect-auto max-h-[min(30vh,240px)] [@media(min-height:780px)]:max-h-[min(40vh,360px)] [@media(min-height:900px)]:max-h-[min(45vh,420px)] object-contain bg-black/40"
```

---

## Comportamento Atteso

| Viewport | Comportamento |
|----------|---------------|
| **iPhone Mini** (812px) | Media: max 30vh (~244px). Testo: 4 righe. Font: 16px. Tutto visibile. |
| **iPhone Pro** (844px) | Media: max 40vh (~338px). Testo: 6 righe. Font: ~18px. |
| **iPhone Pro Max** (926px+) | Media: max 45vh (~417px). Testo: 8 righe. Font: 20px. Più contenuto. |

### Checklist Visiva
- Profilo autore appena sotto il safe area top (niente gap 64px)
- Action bar appena sopra il safe area bottom (niente gap 104px)
- Contenuto parte dall'alto verso il basso (non centrato)
- Testo lungo si adatta con line-clamp + ellissi (no taglio brutale)
- Media si ridimensiona su schermi piccoli (non schiaccia tutto)
- Quoted post ha altezza limitata ma con bordi arrotondati (no taglio secco)

---

## Dettagli Tecnici

### Perché `env(safe-area-inset-*)`
Questi valori CSS dinamici sono forniti dal browser e rappresentano esattamente lo spazio occupato da notch, Dynamic Island, e home indicator. Usandoli nei `calc()`, il layout si adatta automaticamente a ogni dispositivo.

### Perché `justify-start` con `gap`
Con `justify-center`, quando c'è poco contenuto viene spinto al centro creando vuoti sopra e sotto. Con `justify-start` + `gap-4`, il contenuto parte dall'alto e ha spaziatura uniforme tra elementi.

### Perché `clamp()` per i font
`clamp(min, preferred, max)` crea font fluidi che scalano con il viewport:
- `text-[clamp(1rem,3.5vw,1.25rem)]` = min 16px, scala con 3.5% della larghezza, max 20px

### Perché media query `min-height` invece di `sm`
I breakpoint Tailwind come `sm:` sono basati sulla **larghezza**. Ma il problema è l'**altezza** del viewport. Le media query arbitrarie `[@media(min-height:780px)]` permettono di reagire alla dimensione verticale.

### Perché `min()` nei `max-h`
`max-h-[min(30vh,240px)]` significa: "il minore tra 30% dell'altezza viewport e 240px". Questo previene che su schermi molto alti le immagini diventino enormi, e su schermi molto piccoli garantisce un'altezza minima ragionevole.

