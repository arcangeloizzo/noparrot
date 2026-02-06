
# Piano: Layout Uniforme per Card Immersive del Feed

## Problema Identificato
Le card hanno padding e posizionamenti **inconsistenti**:

| Card | Padding Top | Padding Bottom | Problema |
|------|-------------|----------------|----------|
| **ImmersivePostCard** | `pt-14` | `pb-28 sm:pb-32` | Content `flex-1` cresce senza limiti |
| **ImmersiveFocusCard** | `pt-14` | `pb-24` | Meno padding in basso |

Quando il contenuto cresce, i pulsanti finiscono "schiacciati" sulla navbar o fuori schermo. Inoltre, l'utente percepisce inconsistenza visiva tra i tipi di card.

## Soluzione: Layout Uniforme a 3 Zone

```text
┌─────────────────────────┐  ← pt-16 (safe area + status bar)
│     HEADER ZONE         │  flex-shrink-0 (non si comprime mai)
│  [Avatar] [Name] [Time] │
├─────────────────────────┤
│                         │
│     CONTENT ZONE        │  flex-1 + overflow-hidden
│   (max-h limitato)      │  Il contenuto si tronca con line-clamp
│   (no scroll interno)   │
│                         │
├─────────────────────────┤
│     ACTION ZONE         │  flex-shrink-0 (non si comprime mai)
│ [Condividi] [❤️] [💬] [🔖]│
└─────────────────────────┘  ← pb-28 sm:pb-32 (navbar + safe area)
```

## File da Modificare

### 1. `src/components/feed/ImmersivePostCard.tsx`

**A) Content Layer (linea ~1223)**
Uniformare padding top:
```tsx
// DA:
<div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-28 sm:pb-32">

// A:
<div className="relative z-10 w-full h-full flex flex-col pt-16 pb-28 sm:pb-32">
```
Rimuoviamo `justify-between` perché useremo `flex-shrink-0` sulle zone fisse.

**B) Top Bar (linea ~1226)**
Aggiungere `flex-shrink-0` per evitare compressione:
```tsx
<div className="flex justify-between items-start flex-shrink-0">
```

**C) Center Content (linea ~1333)**
Aggiungere `overflow-hidden` per impedire che straripi:
```tsx
// DA:
<div className="flex-1 flex flex-col justify-center px-2 pt-2 sm:pt-2">

// A:
<div className="flex-1 flex flex-col justify-center px-2 pt-2 sm:pt-2 overflow-hidden">
```

**D) Rimuovere spacer flessibile (linea ~2036)**
Eliminare completamente:
```tsx
<div className="min-h-4 sm:min-h-0 flex-shrink-0" />
```

**E) Action Bar (linea ~2039)**
Aggiungere `flex-shrink-0`:
```tsx
// DA:
<div className="flex items-center justify-between gap-6 mr-12 sm:mr-16">

// A:
<div className="flex items-center justify-between gap-6 mr-12 sm:mr-16 flex-shrink-0">
```

### 2. `src/components/feed/ImmersiveFocusCard.tsx`

**A) Content Layer (linea ~104)**
Uniformare padding per coerenza visiva:
```tsx
// DA:
<div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-24">

// A:
<div className="relative z-10 w-full h-full flex flex-col pt-16 pb-28 sm:pb-32">
```

**B) Top Bar (linea ~107)**
Aggiungere `flex-shrink-0`:
```tsx
// DA:
<div className="flex flex-col gap-2">

// A:
<div className="flex flex-col gap-2 flex-shrink-0">
```

**C) Center Content (linea ~216)**
Aggiungere `overflow-hidden`:
```tsx
// DA:
<div className="flex-1 flex flex-col justify-center px-2">

// A:
<div className="flex-1 flex flex-col justify-center px-2 overflow-hidden">
```

**D) Action Bar (linea ~246)**
Aggiungere `flex-shrink-0`:
```tsx
// DA:
<div className="flex items-center justify-between gap-3">

// A:
<div className="flex items-center justify-between gap-3 flex-shrink-0">
```

### 3. `src/components/feed/QuotedPostCard.tsx`

Limitare altezza massima del container per i quoted post ricondivisi:
```tsx
// Wrapper del MediaGallery interno, aggiungere max-h
<div className="max-h-[30vh] overflow-hidden rounded-xl">
  <MediaGallery ... />
</div>
```

### 4. `src/components/media/MediaGallery.tsx`

Limitare altezza massima delle immagini `aspect-auto` per evitare che crescano troppo:
```tsx
// DA:
className="w-full aspect-auto object-contain bg-black/40"

// A:
className="w-full aspect-auto max-h-[45vh] object-contain bg-black/40"
```

## Comportamento Atteso

| Scenario | Prima | Dopo |
|----------|-------|------|
| Post con molto contenuto | Action bar schiacciata/fuori viewport | Action bar sempre a distanza fissa dal bottom |
| FocusCard | `pb-24` (meno spazio) | `pb-28 sm:pb-32` (uniforme con PostCard) |
| Qualsiasi card | Inconsistenza visiva tra tipi | Layout uniforme su tutte le card |
| iPhone 12/13 mini | Bottoni sulla navbar | Spazio costante tra azioni e navbar |

## Dettagli Tecnici

### Perché `flex-shrink-0`
Nelle colonne flex, gli elementi possono comprimersi quando lo spazio è insufficiente. Con `flex-shrink-0`, header e action bar **non si comprimono mai**, costringendo il contenuto centrale ad adattarsi.

### Perché `overflow-hidden` senza scroll
Il contenuto che eccede viene troncato visivamente. I testi già usano `line-clamp-2/4`, quindi il troncamento è già gestito elegantemente. Gli elementi media verranno limitati con `max-h`.

### Nessuno scroll nidificato
Lo scroll del feed rimane l'unico scroll verticale. Nessun conflitto con lo snap-scroll.
