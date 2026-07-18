## Diagnosi — perché le card corte non sono centrate

Catena d'altezza attuale, dall'esterno all'interno:

```text
.embla-slide             flex:0 0 var(--feed-viewport-h)   ← ALTEZZA REALE (vh − 56 − 88)
└─ [data-slide-scroll]   height:100%; overflowY:auto       ✅ risolve (parent ha flex-basis)
   └─ FeedWrapper        minHeight:100%; paddingBottom:48px ⚠️ % ok, ma +48px forza overflow SEMPRE
      └─ card-container  minHeight: calc(var(--vh)*100)     ❌ SLEGATO dallo slot
         flex-col items-center JUSTIFY-CENTER               ❌ clippa la cima se figlio più alto
         └─ boxRef       margin:auto                        (già ok se il parent non clippa)
```

Due bug indipendenti che si sommano:

1. **`minHeight: calc(var(--vh)*100)` sulla root della card ≠ altezza dello slot Embla.** Lo slot vale `vh − 56 − 88`, la card pretende `vh` pieno. La card è quindi *sempre* più alta dello slot → l'inner scroller `data-slide-scroll` ha *sempre* overflow → anche una card cortissima parte in alto e richiede scroll per essere vista intera. Questa è la causa principale del sintomo riportato.
2. **`justify-content: center` su un flex-column il cui figlio può superare il parent → clippa la cima.** È il bug flexbox classico. Se lo risolvessimo solo con `minHeight:100%` senza cambiare l'allineamento, le card lunghe (articoli/reshare/summary — che sono il caso normale) perderebbero header/titolo.
3. **`FeedWrapper` ha `paddingBottom:48px`.** Anche a card cortissima, forza sempre l'altezza del contenuto interno oltre il 100% dello slot → contribuisce a mantenere lo scroll attivo. Il "respiro" di 48 px va spostato dentro la card (bottom padding del contenuto), non applicato al wrapper.
4. **`ImmersiveEditorialCarousel` usa `h-[100dvh]` sulla root e `minHeight: calc(vh*100)` sulla slide interna.** Stessi due problemi: hard-height in dvh legato al viewport globale, non allo slot Embla; nessuna centratura sicura.

## Meccanismo per "centrata-se-corta E no-clip-se-lunga"

Il pattern giusto è **flex-column + `margin:auto` sul figlio**, MAI `justify-content:center`:

- Parent: `display:flex; flex-direction:column; min-height:100%`.
- Figlio (box flottante): `margin:auto` (già presente).

Con questo pattern:
- Card **corta**: il figlio è più piccolo del parent → `margin:auto` distribuisce lo spazio libero sopra/sotto ⇒ **centrata**. Poiché il parent è `min-height:100%` (non `100vh`), la card non supera lo slot, l'inner scroller non ha overflow ⇒ **niente scroll**.
- Card **lunga**: `margin:auto` diventa 0 quando non c'è spazio libero (comportamento standard flex, a differenza di `justify-center`) ⇒ **nessun clip del top**. L'overflow viene gestito dall'inner scroller `data-slide-scroll` come oggi.

Perché i `%` si risolvono davvero: la catena è `slide (basis fisso) → data-slide-scroll (height:100%, definito) → FeedWrapper (min-height:100%) → card root (min-height:100%)`. Ogni anello ha un parent con dimensione definita, quindi i percentuali collassano fino allo slot Embla. Nessuna catena "min-height:% su parent auto".

## Diff proposti (non applicati, minimali)

### 1) `src/components/feed/ImmersiveFeedContainer.tsx` — `FeedWrapper`
```diff
-  style={{
-    minHeight: '100%',
-    paddingBottom: '48px',
-  }}
-  className="w-full shrink-0 relative"
+  style={{ minHeight: '100%' }}
+  className="w-full shrink-0 relative flex flex-col"
```
Motivo: rimuove il `+48px` che forza overflow anche a card corte; imposta il wrapper come flex-column così che il `margin:auto` del figlio funzioni. Il respiro visivo di 48 px verrà, se serve, replicato come `padding-bottom` sul contenuto della card (fuori scope di questo blocco, non introduce regressioni: oggi quel padding è "sotto tutto", non contribuisce alla composizione visiva della card).

### 2) `src/components/feed/ImmersivePostCard.tsx` — root card (riga ~2166)
```diff
-  className="w-full relative bg-immersive transition-colors duration-500 flex flex-col items-center justify-center"
-  style={{ isolation: 'isolate', contain: 'layout style', minHeight: 'calc(var(--vh, 1vh) * 100)' }}
+  className="w-full relative bg-immersive transition-colors duration-500 flex flex-col items-center"
+  style={{ isolation: 'isolate', contain: 'layout style', minHeight: '100%' }}
```
Motivo: allinea la card allo slot Embla (`100%`, non `100vh`) e rimuove `justify-center` per evitare il clip della cima sulle card lunghe. `items-center` resta per l'asse orizzontale. La centratura verticale è delegata al `margin:auto` già presente sul `boxRef`.

### 3) `src/components/feed/ImmersiveEditorialCarousel.tsx` — root (riga 233) + slide interna (riga 568)
```diff
- <div className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden">
+ <div className="w-full relative flex flex-col overflow-hidden" style={{ minHeight: '100%' }}>
```
```diff
- className="flex-[0_0_100%] min-w-0 relative cursor-pointer transform-gpu will-change-transform flex flex-col justify-start"
- style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}
+ className="flex-[0_0_100%] min-w-0 relative cursor-pointer transform-gpu will-change-transform flex flex-col"
+ style={{ minHeight: '100%' }}
```
Motivo: stessa logica — root ancorata allo slot Embla, slide con `min-height:100%` e centratura via `margin:auto` esistente. Rimuovo `snap-start` e `justify-start` residui che non hanno più significato dentro Embla (Embla non è uno scroll-snap container).

## Cosa NON tocco

- `useDynamicCardLayout` e qualunque motore di misura contenuti card.
- `AmbientLayer`, cinematic-fade, urban-noise overlays.
- Config Embla in `ImmersiveFeedContainer` (axis, align, duration, watchDrag).
- `handleTouchStart/Move/End`, logica pull-to-refresh, logica edge-swipe.
- I residui `scrollSnapAlign` / `scrollMarginTop` / `scrollMarginBottom` sui box flottanti: inerti con Embla, si rimuoveranno in un pass di pulizia successivo.
- Le regole `padding-bottom: 9vh/12vh` di `.zone-mid--hero` / `.zone-mid--poster` in `src/index.css`: da valutare a schermo dopo aver applicato questo blocco.
- Nessuna modifica ai token CSS (`--feed-viewport-h`, `--vh`, `--zone-*`) né a `useStableViewportHeight`.

## Verifica dopo l'implementazione (fuori da questo piano)

- Card corta (poll-only / title-only / Il Punto short) → box centrato verticalmente, `data-slide-scroll` senza barra di scroll.
- Card lunga (articolo, reshare stack, transcript, summary) → cima immediatamente visibile a snap, scroll interno regolare fino al bottom, edge-swipe verso la prossima intatto.
- Nessuna regressione in `ImmersiveEditorialCarousel` (Il Punto) sia con item singolo che con carousel orizzontale.
