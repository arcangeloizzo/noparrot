
# Piano: Ottimizzazione Layout 3 Zone per Card Immersive

## Problemi Identificati

### 1. Troppo spazio vuoto
- **Top**: `pt-16` (64px) lascia troppo spazio tra header app e profilo autore
- **Bottom**: `pb-28` (112px) lascia troppo spazio tra action bar e navbar

### 2. Contenuto tagliato nettamente
- `overflow-hidden` sul wrapper centrale taglia il contenuto senza rispettare i `line-clamp` esistenti
- Il testo e i media vengono troncati a metà invece di usare ellissi o `line-clamp`

## Soluzione

### Valori di Padding Ottimizzati
| Zona | Prima | Dopo | Spazio Reale |
|------|-------|------|--------------|
| Top | `pt-16` (64px) | `pt-14` (56px) | Header app 56px + safe area |
| Bottom | `pb-28` (112px) | `pb-24` (96px) | Navbar 64px + safe area + margine |

### Rimozione `overflow-hidden` dal Content Wrapper
Il `overflow-hidden` causa il taglio netto. Invece:
- Rimuovere `overflow-hidden` dal wrapper centrale
- Lasciare che i singoli elementi (testi, media, quoted) gestiscano il proprio troncamento con `line-clamp` e `max-h`
- Il container padre (`h-[100dvh]` con `flex flex-col`) garantisce già che il layout non straripii

## Modifiche Dettagliate

### 1. `src/components/feed/ImmersivePostCard.tsx`

**A) Content Layer (linea ~1223)**
```tsx
// DA:
<div className="relative z-10 w-full h-full flex flex-col pt-16 pb-28 sm:pb-32">

// A:
<div className="relative z-10 w-full h-full flex flex-col pt-14 pb-24 sm:pb-28">
```

**B) Center Content (linea ~1333)**
```tsx
// DA:
<div className="flex-1 flex flex-col justify-center px-2 pt-2 sm:pt-2 overflow-hidden">

// A (rimuovere overflow-hidden, usare min-h-0 per flex truncation):
<div className="flex-1 flex flex-col justify-center px-2 pt-2 sm:pt-2 min-h-0">
```

`min-h-0` è il trucco Flexbox per permettere ai figli di shrinkare correttamente senza `overflow-hidden`.

### 2. `src/components/feed/ImmersiveFocusCard.tsx`

**A) Content Layer (linea ~104)**
```tsx
// DA:
<div className="relative z-10 w-full h-full flex flex-col pt-16 pb-28 sm:pb-32">

// A:
<div className="relative z-10 w-full h-full flex flex-col pt-14 pb-24 sm:pb-28">
```

**B) Center Content (linea ~216)**
```tsx
// DA:
<div className="flex-1 flex flex-col justify-center px-2 overflow-hidden">

// A:
<div className="flex-1 flex flex-col justify-center px-2 min-h-0">
```

### 3. Aggiungere `line-clamp` ai Testi Lunghi

Nel `ImmersivePostCard`, alcuni testi non hanno `line-clamp`. Aggiungere dove manca:

**Testo stack layout (linea ~1338)**
```tsx
// DA:
<div className="text-base sm:text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-3 sm:mb-4 ...">

// A (aggiungere line-clamp-4):
<div className="text-base sm:text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-3 sm:mb-4 line-clamp-4 ...">
```

### 4. Quoted Post già Limitato
Il `QuotedPostCard` ha già `max-h-[30vh]` dall'implementazione precedente, che è corretto.

## Perché Questa Soluzione Funziona

1. **`min-h-0`**: In Flexbox, i figli hanno `min-height: auto` di default, che impedisce lo shrink. Con `min-h-0`, il content wrapper può ridursi correttamente.

2. **`line-clamp` sui testi**: Il testo si tronca con ellissi (...) invece di essere tagliato a metà.

3. **Padding ottimizzati**: Lo spazio è calibrato esattamente per header (56px) e navbar (64px + safe area).

## Comportamento Atteso

| Scenario | Prima | Dopo |
|----------|-------|------|
| Post lungo | Testo tagliato a metà | Testo con ellissi (line-clamp) |
| Spazio header-profilo | 64px vuoti | 56px, più compatto |
| Spazio action-navbar | 112px vuoti | 96px, più compatto |
| Media + quoted post | Quoted tagliato nettamente | Quoted con max-h e rounded corners |

## Sezione Tecnica

### Valori Finali
- `pt-14` = 56px (esattamente l'altezza dell'header)
- `pb-24 sm:pb-28` = 96px / 112px (navbar 64px + 32-48px margine sicurezza)
- `min-h-0` = permette ai flex children di shrinkare oltre il loro contenuto intrinseco
- `line-clamp-4` = massimo 4 righe con ellissi per testi lunghi
