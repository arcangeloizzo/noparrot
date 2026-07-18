## Diagnosi CSS — perché `margin:auto` non centra

### Catena STANDARD (attuale, post-d963e09)

```text
[data-slide-scroll]  height:100%; overflowY:auto              ← altezza definita (slot Embla)
└─ FeedWrapper       min-height:100%; flex flex-col           ⚠ min-height, non height
   └─ card-container min-height:100%; flex flex-col items-center  ❌ % non risolve
      └─ box         margin:auto                              ❌ nessuno spazio libero
```

Il bug è nella regola CSS di risoluzione dei percentuali su `min-height`:

- `min-height: 100%` su un figlio **si risolve solo se il parent ha una `height` definita** (non solo `min-height`). `FeedWrapper` ha *solo* `min-height:100%` → per la `card-container`, `min-height:100%` degrada a `auto`.
- Conseguenza: la `card-container` prende altezza = altezza del contenuto (= altezza del box). Non c'è spazio libero da distribuire → `margin:auto` collassa a 0 → il box appare in alto. Il vuoto visibile sotto è dello *scroller esterno*, non della card.
- Non è un problema di `items-center`: quello agisce solo sull'asse cross (orizzontale). L'asse main verticale è quello che manca di dimensione definita.

Perché nel piano precedente si pensava funzionasse: si assumeva che `min-height:100%` si propagasse lungo tutta la catena. In realtà serve almeno un anello con `height` definita (o `flex:1` in un flex container con altezza definita) affinché i `%` successivi si risolvano.

### Catena IL PUNTO (`ImmersiveEditorialCarousel`)

```text
[data-slide-scroll]  height:100%
└─ FeedWrapper       min-height:100%; flex flex-col
   └─ Root           min-height:100%; flex flex-col overflow-hidden    ⚠ min-height
      └─ Content     h-full; flex flex-col                             ❌ h-full % non risolve
         └─ Carousel flex-1; overflow-hidden                           ← se Content ha altezza, ok
            └─ emblaX flex; h-full                                     ← h-full su main-axis flex
               └─ Slide flex-[0_0_100%]; min-height:100%; flex flex-col ❌ min-height % non risolve
                  └─ box margin:auto                                   ❌ nessuno spazio
```

Stesso identico bug alla radice: `Root` è `min-height:100%` senza `height`, quindi ogni `h-full` / `min-height:100%` a valle degrada a auto. Il box si ancora in alto.

Nota aggiuntiva su `overflow-hidden` del Carousel Container: serve a Embla per non mostrare le slide adiacenti orizzontalmente, ma clippa anche l'asse Y. Se una slide superasse lo slot, il contenuto sotto sarebbe tagliato senza possibilità di scroll (il `data-slide-scroll` esterno non aiuta perché il taglio avviene *dentro* il carosello).

## Meccanismo corretto

Regola CSS che garantisce sia centratura-se-corta sia no-clip-se-lunga:

- **Un anello della catena deve avere `height` (non solo `min-height`) definita**, così i `%` successivi risolvono.
- **L'anello che contiene il box deve essere un flex-column che si stira a tutto lo slot**, sia con contenuto corto sia lungo.
- **Il box usa `margin:auto`** (già presente): con parent flex-col dimensionato, `margin:auto` distribuisce lo spazio libero verticale quando c'è (corto → centrato); degrada a 0 quando non c'è (lungo → box al top, nessun clip perché `overflow` del parent è `visible`).

Traduzione operativa in due mosse minime:

1. **`FeedWrapper` diventa `height:100%`** (invece di `min-height:100%`). È l'anello che ancora la catena al `data-slide-scroll`. Overflow verticale è gestito dal `data-slide-scroll` (il figlio card-container può superare 100%, non viene clippato perché `FeedWrapper` è block con overflow visible di default).
2. **`card-container` (ImmersivePostCard) e `EditorialSlide` (Il Punto) prendono `flex-1`** dentro il loro parent flex-col. `flex-1` = `flex:1 1 0%`: l'item si stira a riempire il parent quando corto, ma cresce oltre quando il contenuto lo richiede (in flex, `min-content` impedisce di comprimere sotto il contenuto intrinseco). Risultato: altezza dell'anello = `max(contenuto, altezza parent)`.

Per Il Punto serve anche cambiare `overflow-hidden` → `overflow-x-hidden` sul Carousel Container: Embla ha bisogno del clip solo su X. In Y lasciamo `visible` così, nel caso raro di slide con contenuto > slot, il box può eccedere senza taglio grafico. Se in futuro serve gestire davvero lo scroll interno per Il Punto, si aggiunge un inner-scroller sulla singola `EditorialSlide` in uno step successivo — fuori scope qui, dato che i contenuti editoriali sono corti per design.

Perché card lunghe standard non regrediscono: `card-container` con `flex-1` si stira ad almeno l'altezza dello slot, ma cresce quando il contenuto è più alto; `margin:auto` sul box degrada a 0 → il box parte dal top; il `data-slide-scroll` esterno scrolla come oggi. Nessuna modifica al motore di misura né agli handler touch.

## Diff PROPOSTI (testo, NON applicati)

### 1) `src/components/feed/ImmersiveFeedContainer.tsx` — `FeedWrapper`

```diff
   <div
     ref={registerRef}
-    style={{ minHeight: '100%' }}
+    style={{ height: '100%' }}
     className="w-full shrink-0 relative flex flex-col"
   >
```

Motivo: fornire alla catena l'anello con altezza definita. `height:100%` risolve contro `data-slide-scroll` (che è `height:100%` del proprio slot Embla, a sua volta `flex:0 0 var(--feed-viewport-h)`, definito). Da qui in giù ogni `%` / `flex-1` risolve. Il contenuto interno che eccede non viene clippato: `FeedWrapper` è block, `overflow:visible` di default; il `data-slide-scroll` è l'unico scroller.

### 2) `src/components/feed/ImmersivePostCard.tsx` — root card (riga ~2166)

```diff
-  className="w-full relative bg-immersive transition-colors duration-500 flex flex-col items-center"
-  style={{ isolation: 'isolate', contain: 'layout style', minHeight: '100%' }}
+  className="w-full flex-1 relative bg-immersive transition-colors duration-500 flex flex-col items-center"
+  style={{ isolation: 'isolate', contain: 'layout style' }}
```

Motivo: `flex-1` (dentro `FeedWrapper` che è `flex flex-col` con `height:100%`) stira la card a riempire lo slot quando il contenuto è più corto, e permette la crescita oltre 100% quando è più lungo. `min-height:100%` diventa ridondante (rimosso per non mescolare due meccanismi). `items-center` (cross-axis) resta; la centratura verticale è delegata al `margin:auto` già presente sul `boxRef`.

### 3) `src/components/feed/ImmersiveEditorialCarousel.tsx` — Root, Carousel Container, EditorialSlide

Root (riga 233):

```diff
- <div className="w-full relative flex flex-col overflow-hidden" style={{ minHeight: '100%' }}>
+ <div className="w-full h-full relative flex flex-col overflow-hidden">
```

Carousel Container (riga 242-244):

```diff
   <div
     ref={emblaRef}
-    className="flex-1 overflow-hidden touch-pan-y"
+    className="flex-1 overflow-x-hidden touch-pan-y"
   >
```

EditorialSlide (riga 568-570):

```diff
   <div
-    className="flex-[0_0_100%] min-w-0 relative cursor-pointer transform-gpu will-change-transform flex flex-col"
-    style={{ minHeight: '100%' }}
+    className="flex-[0_0_100%] min-w-0 h-full relative cursor-pointer transform-gpu will-change-transform flex flex-col"
     onClick={onClick}
   >
```

Motivo:
- Root con `h-full` (risolve contro `FeedWrapper` ora `height:100%`) fornisce l'anello dimensionato al sottoalbero editoriale.
- Carousel Container passa a `overflow-x-hidden`: Embla continua a clippare le slide adiacenti orizzontalmente; asse Y libero, così un box lungo non viene tagliato (fallback: box ancorato al top via `margin:auto→0`).
- `EditorialSlide` con `h-full`: dentro `emblaX` (che è `flex h-full`, main-axis orizzontale, cross-axis verticale con stretch di default), `h-full` sull'asse verticale (cross) è ridondante ma esplicito e robusto contro cambi di config. Rimosso `min-height:100%` per lo stesso motivo del caso standard (evitare mescolanza di meccanismi). `margin:auto` sul box interno centra quando c'è spazio libero.

## Cosa NON tocco

- Motore `useDynamicCardLayout`, catena di misura e osservatori.
- `AmbientLayer`, `card-scrim`, `cinematic-fade-overlay`, `urban-noise-overlay`.
- Config Embla (`axis`, `align`, `duration`, `containScroll`, `skipSnaps`).
- `watchDrag`, `handleTouchStart/Move/End`, pull-to-refresh, edge-swipe.
- Residui `scrollSnapAlign` / `scrollMarginTop` / `scrollMarginBottom` sui box (inerti con Embla, pulizia successiva).
- `padding-bottom: 9vh / 12vh` di `.zone-mid--hero` e `.zone-mid--poster` in `src/index.css`.
- Token CSS (`--feed-viewport-h`, `--vh`, `--zone-*`) e `useStableViewportHeight`.
- La rifinitura grafica delle 3 zone / liquid glass (step successivo).

## Verifica dopo l'implementazione (fuori scope di questo piano)

- Card corta standard (title-only / poll-only / Il Punto short): box verticalmente centrato nello slot, nessuna barra di scroll nel `data-slide-scroll`, vuoto simmetrico sopra e sotto.
- Card lunga standard (articolo, reshare stack, transcript, summary): cima immediatamente visibile a snap, scroll interno regolare fino in fondo, edge-swipe alla card successiva intatto.
- Il Punto con item unico: box centrato nello slot editoriale.
- Il Punto carousel orizzontale multi-item: swipe orizzontale invariato, ciascuna slide con box centrato.
- Nessuna regressione nella sensazione di snap Embla verticale.
