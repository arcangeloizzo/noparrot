
# Piano — Embla Carousel per feed verticale con card ad altezza variabile

## Risposte alle 6 domande

### 1) Embla verticale supporta il nostro caso?

Sì, con `axis: 'y'`. Ma con una **precisazione fondamentale sull'architettura**: Embla non è uno "scroll container" nativo — è un carosello a **transform**. Il `container` viene traslato (`translate3d`) come blocco unico; le slide non sono navigate via `scrollTop`. Conseguenze:

- Slide ad "altezza naturale variabile" sono supportate meccanicamente (Embla misura ogni slide e calcola gli snap point), **ma se una slide è più alta del viewport, il contenuto in eccesso non è raggiungibile** perché Embla passa direttamente alla successiva: non c'è scroll intra-slide.
- Per ottenere "leggi internamente la card lunga, poi swipa alla prossima" servono **slide = shell dimensione viewport** con **contenuto interno scrollabile nativamente** (`overflow-y: auto`) — Pattern A qui sotto.

Opzioni Embla che useremo:
- `axis: 'y'`
- `align: 'start'` (top della slide = top del viewport Embla)
- `containScroll: 'trimSnaps'` (nessun overscroll oltre prima/ultima)
- `dragFree: false` (snap deterministico, non momentum libero)
- `skipSnaps: false` (uno alla volta, sempre)
- `duration: 20–25` (animazione snap)
- `watchDrag: (api, e) => boolean` (custom — vedi §2)
- `watchResize: true`, `watchSlides: true`

Il plugin **AutoHeight non serve** (e non lo useremmo comunque): il viewport ha altezza fissa "schermo − 56 − 88".

### 2) Card più alta del viewport → scroll interno vs drag Embla

Pattern scelto — **Pattern A "shell + inner scroll"**:
- Ogni `.embla__slide` ha `flex: 0 0 var(--slot-h)` dove `--slot-h = calc(var(--vh)*100 - 56px - 88px)` (altezza esatta del viewport Embla).
- Dentro la slide c'è un wrapper `.slide-scroll` con `height: 100%; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;` che contiene la card reale.
- **Card corte**: `.slide-scroll` non ha contenuto in overflow, quindi nessuno scroll interno → drag verticale = Embla che snappa alla prossima.
- **Card lunghe**: `.slide-scroll` ha contenuto in overflow → l'utente scrolla nativamente dentro. Embla non intercetta perché usiamo `watchDrag` per **rifiutare il drag** quando l'interno può ancora scorrere in quella direzione.

Logica `watchDrag(api, evt)`:
1. Trova il primo antenato di `evt.target` con `data-slide-scroll="true"` (il wrapper interno).
2. Se non esiste → `return true` (Embla gestisce).
3. Se esiste, leggi `scrollTop`, `scrollHeight`, `clientHeight`.
   - `atTop = scrollTop <= 0`
   - `atBottom = scrollTop + clientHeight >= scrollHeight - 1`
   - Direzione del gesto: la determiniamo salvando `touchstart.clientY` in un ref e leggendo `evt` in `touchmove`; oppure, più semplice, usiamo lo stato dell'inner: **se l'inner NON è a un edge in nessuna direzione, `return false` (Embla ignora, nativo scrolla)**. Se è a un edge, `return true` (Embla può iniziare il drag). Questa è la regola classica dei "nested scrollers" e funziona su iOS perché appena il dito parte, se l'inner non è a un edge, iOS gestisce il momentum nativo dell'inner; quando l'inner raggiunge un edge, un successivo gesture viene passato a Embla.

Nota iOS: `overscroll-behavior: contain` sull'inner previene il "chain" verso il body/PTR. `touch-action: pan-y` sul container Embla; nessun `touch-action: none` che rompa il momentum nativo.

### 3) Sostituire `IntersectionObserver` con `emblaApi.on('select')`

Sì. Al mount:
```
emblaApi.on('select', () => onActiveIndexChange?.(emblaApi.selectedScrollSnap()))
emblaApi.on('reInit', () => onActiveIndexChange?.(emblaApi.selectedScrollSnap()))
```
`select` scatta appena l'indice attivo cambia (a fine drag, dopo lo snap). Non serve più IO. Rimuoviamo tutto il blocco IO (osservatore, mappa `entryRatios`, callback ratio, threshold array, ecc.).

Per lo scroll programmatico (`scrollToIndex` esposto via ref imperativo):
```
scrollToIndex: (i) => emblaApi.scrollTo(i)
```
oppure `scrollTo(i, true)` per jump senza animazione se serve.

### 4) OVERSCAN=1 compatibile con Embla?

Sì, ed è il vantaggio del Pattern A: la **shell** di ogni slide ha altezza fissa (`--slot-h`) e resta montata come slot vuoto (identica a oggi via `FeedWrapper`). Solo il **contenuto interno** (card React pesante) viene montato/smontato per `activeIndex ± 1`. Embla misura l'altezza degli slot (che non cambia) → nessun `reInit` necessario al cambio di attivo.

Casi in cui invochiamo `emblaApi.reInit()`:
- Al cambio del numero di items (`items.length`).
- Al cambio dell'altezza del viewport (`--vh` aggiornato dall'hook `useStableViewportHeight`).
- Su `resize` window (già coperto da `watchResize: true`, ma un `reInit` esplicito su `--vh` è più affidabile su iOS).

Empty slot con `--slot-h` come `minHeight`/`height`: perfetto.

### 5) Pull-to-refresh convivente con drag Embla

Il PTR attuale attiva solo quando `containerRef.scrollTop === 0`. Con Embla, il container di scroll cambia: **la scroll position "0" ora è `emblaApi.selectedScrollSnap() === 0` E `slideScrollEl.scrollTop === 0`**.

Implementazione:
- Attacchiamo `onTouchStart/Move/End` al **viewport Embla** (lo stesso ref di `emblaRef`).
- Nel `watchDrag` callback, se siamo sullo slide 0 con inner `atTop`, **ritorniamo `false`** in modo che Embla NON inizi il drag e lasciamo che il nostro handler gestisca il pull.
- Il nostro handler misura `deltaY`, applica un translate visivo sull'indicatore di PTR, e a rilascio: se `> 80px` → refresh; altrimenti reset.
- In tutti gli altri casi lo `handleTouchStart` esce subito senza toccare nulla.

Attenzione: il PTR non deve mai chiamare `preventDefault` sul move (rompe momentum iOS). Solo trasformare visivamente un indicatore fuori-flusso.

### 6) Piano a step atomici

Ogni step è verificabile in isolamento (build passa + verifica visiva).

**Step 0 — Prep (nessuna modifica ancora):**
- Confermare `useStableViewportHeight` in `App` scrive `--vh`.
- Confermare l'altezza esatta di top-bar (56) e bottom nav (88). ← già confermato dal contesto.

**Step 1 — Install & tokens:**
- `bun add embla-carousel-react`
- In `src/index.css` aggiungere token `--feed-viewport-h: calc(var(--vh, 1vh) * 100 - 56px - 88px);` (nome semantico; se già esiste un token affine, riusarlo).

**Step 2 — Struttura Embla nel container (solo `ImmersiveFeedContainer.tsx`):**
- Sostituire il `<div className="w-full overflow-y-scroll snap-y snap-mandatory ...">` con:
  ```
  <div className="embla-viewport" ref={emblaRef} style={{height: 'var(--feed-viewport-h)', marginTop: 56, ...}}>
    <div className="embla-container">
      {items.map((it, i) => (
        <div className="embla-slide" key={it.id} style={{flex:'0 0 var(--feed-viewport-h)'}}>
          <div data-slide-scroll="true" className="slide-scroll">
            <FeedWrapper isVisible={isVisible(i)} registerRef={...}>
              {isVisible(i) ? <Card .../> : null}
            </FeedWrapper>
          </div>
        </div>
      ))}
    </div>
  </div>
  ```
- CSS: `.embla-container { display: flex; flex-direction: column; height: 100%; } .slide-scroll { height:100%; overflow-y:auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }`
- Rimuovere `snap-y snap-mandatory` e i residui `scrollSnapAlign/scrollMargin` nei box interni delle card (Pattern A non li usa più).

**Step 3 — Hook Embla + active index:**
- `const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y', align: 'start', containScroll: 'trimSnaps', dragFree: false, skipSnaps: false, duration: 22, watchDrag: watchDragFn })`
- `useEffect` con `emblaApi.on('select', ...)` → `onActiveIndexChange(emblaApi.selectedScrollSnap())`.
- `useImperativeHandle` → `scrollToIndex: (i) => emblaApi?.scrollTo(i)`.

**Step 4 — Rimuovere IntersectionObserver:**
- Cancellare `observerRef`, `entryRatiosRef`, callback IO e relativo `useEffect`.
- `FeedWrapper` mantiene `registerRef` solo se serve altrove (verificare usi); altrimenti semplificarlo.

**Step 5 — `watchDrag` nested-scroll guard:**
- Implementare la funzione descritta al §2 con reading di `data-slide-scroll` closest, `scrollTop/scrollHeight/clientHeight`.

**Step 6 — PTR adattato:**
- `handleTouchStart` verifica `emblaApi.selectedScrollSnap() === 0` e `activeSlideScrollTop === 0`.
- `watchDrag` in questo stato ritorna `false` per lasciare campo libero.
- Move/end come oggi, sull'indicatore visivo.

**Step 7 — `reInit` su cambi dimensione/count:**
- `useEffect([items.length])` → `emblaApi?.reInit()`.
- `useEffect` che osserva `--vh` (via `ResizeObserver` su `document.documentElement` o listener custom) → `reInit()`.

**Step 8 — Cleanup nelle card:**
- In `ImmersivePostCard.tsx` e `ImmersiveEditorialCarousel.tsx` rimuovere `scrollSnapAlign` e `scrollMarginTop/Bottom` dai box flottanti (residui CSS non più utili con Pattern A). NON toccare layout, dimensioni, contenuto.

**Step 9 — Verifica iOS Safari + PWA:**
- Test manuale: card corta → swipe corto snap; card lunga → scroll interno fluido, arrivo al bottom, swipe ulteriore snap alla prossima; scroll a ritroso simmetrico; PTR a top; nessun "salto random" ai cambi `--vh`.
- `tsc --noEmit` + build clean.

## Rischi e mitigazioni

- **Momentum nativo vs edge-detect**: su iOS, quando l'inner arriva al bottom durante il fling, il gesto è già "consumato" dal momentum e il primo swipe successivo (non lo stesso) è quello che triggera Embla. È il comportamento atteso e desiderato ("swipe intenzionale ai bordi"). Documentare all'utente.
- **`reInit` costoso**: chiamarlo solo su `items.length` e `--vh`, non su ogni cambio `activeIndex`.
- **`FeedWrapper.registerRef`**: se usato solo da IO, si può eliminare del tutto. Verificare eventuali altri usi prima di rimuoverlo.
- **Fallback desktop**: `axis: 'y'` con mouse funziona, ma per rotellina non è nativa in Embla. Non è nello scope (target = iOS), ma opzionalmente si può aggiungere wheel-listener. Da confermare con l'utente se serve.

## Cosa NON cambia

- `ImmersivePostCard.tsx` (a parte rimozione `scrollSnapAlign`/`scrollMargin`).
- `ImmersiveEditorialCarousel.tsx` (idem).
- `useStableViewportHeight`, Service Worker, hooks di layout dinamico.
- Tutta la logica business (query, mutazioni, gate, notifiche, ecc.).

## Domanda aperta

1. Wheel scroll desktop: aggiungere `emblaCarouselWheelGestures` plugin o lasciare desktop senza swipe rotella? (Non target ma UX di test dev.)
2. Confermare che `FeedWrapper.registerRef` non è usato altrove: se sì, semplifichiamo lo slot.
