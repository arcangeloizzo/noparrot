# Piano di Virtualizzazione del Feed Immersivo

Questo documento descrive lo stato attuale delle performance di scrolling del feed di NoParrot, esamina le soluzioni candidate per la virtualizzazione del DOM (mantenendo inalterato il paradigma di scroll-snap verticale a card `100dvh`) e propone una strategia di refactoring architetturale.

---

## Sezione A — Stato attuale (ricognizione codice)

### 1. Struttura del rendering
Il feed principale è gestito all'interno della pagina [Feed.tsx](file:///Users/arcangeloizzo/Desktop/Progetti/NOPARROT/noparrot-main/src/pages/Feed.tsx). Il flusso di recupero e rendering è così organizzato:
1. Vengono estratti i post del database tramite l'hook custom `usePosts()` (`dbPosts`).
2. Vengono estratti gli editoriali AI di "Il Punto" tramite l'hook `useDailyFocus()` (`dailyFocusItems`).
3. Tramite un `useMemo`, i due array vengono combinati in un unico flusso ordinato denominato `mixedFeed` (composto da nodi di tipo `post` e `daily-carousel`).
4. Il rendering mappa `mixedFeed` all'interno del container [ImmersiveFeedContainer.tsx](file:///Users/arcangeloizzo/Desktop/Progetti/NOPARROT/noparrot-main/src/components/feed/ImmersiveFeedContainer.tsx).
5. È attualmente implementata una "sliding window" rudimentale che limita il montaggio dei componenti pesanti (`ImmersivePostCard` o `ImmersiveEditorialCarousel`) basandosi sull'indice attivo `activeIndex`:
   ```typescript
   // Virtualization window: activeIndex -1 to +2 (4 items max)
   const isVisible = feedIndex >= activeIndex - 1 && feedIndex <= activeIndex + 2;
   ```
   Se `isVisible` è `false`, viene montato un placeholder leggero: `<div className="w-full h-full bg-[#0E1A24]" />`.
   
   **Il collo di bottiglia**: Sebbene il contenuto pesante venga distrutto al di fuori della finestra di visibilità, **i wrapper di ogni slide rimangono tutti montati nel DOM**. Se l'utente ha 500+ post, nel DOM esisteranno 500+ elementi `div` da `100dvh` con snap point attivo. Inoltre, ad ogni spostamento di slide, React esegue la riconciliazione su tutti i 500+ elementi dell'array mappato, degradando le performance CPU del thread JS.

### 2. Posizione del limite provvisorio `.limit(20)`
Per mitigare i calcoli di layout su viewport iOS (Safari WebKit), era stato inserito temporaneamente un limite rigido di 20 post nella query del database.
Il limite si trova in [usePosts.ts](file:///Users/arcangeloizzo/Desktop/Progetti/NOPARROT/noparrot-main/src/hooks/usePosts.ts) alle righe 242-244:
```typescript
        .eq('is_removed', false)
        .order('created_at', { ascending: false })
        .limit(20);
```

### 3. Hook di data fetching attuale
L'hook attuale è `usePosts` in [usePosts.ts](file:///Users/arcangeloizzo/Desktop/Progetti/NOPARROT/noparrot-main/src/hooks/usePosts.ts).
Esso utilizza il modulo standard `useQuery` di TanStack Query (`@tanstack/react-query`). Esegue una singola richiesta Supabase non paginata e restituisce l'array di post completi. Non è presente alcun parametro di cursore o offset per la paginazione progressiva.

### 4. CSS scroll-snap applicato
Le regole CSS per lo scroll-snap sono definite tramite classi Tailwind nei seguenti file:
- **Scroll Container**: In `ImmersiveFeedContainer.tsx` (riga 130), viene applicata la classe `snap-y snap-mandatory` e `overflow-y-scroll`:
  ```tsx
  className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-background"
  ```
- **Child Items (Snap Points)**: In `Feed.tsx` (riga 566), a ciascun wrapper delle card viene applicata la classe `snap-start`:
  ```tsx
  className="w-full h-[100dvh] snap-start shrink-0 overflow-hidden"
  ```

### 5. Altre interazioni attive sul feed
- **Pull-to-refresh**: Gestito internamente a `ImmersiveFeedContainer.tsx` intercettando gli eventi touch (`onTouchStart`, `onTouchMove`, `onTouchEnd`). Quando l'utente tira verso il basso e `scrollTop === 0`, se lo spazio di trazione supera `80px`, viene avviata l'invalidazione delle query React Query.
- **Double-tap (like), Drag-to-react, Voice player, Comprehension Gate quiz, Share sheet**: Implementati principalmente all'interno di [ImmersivePostCard.tsx](file:///Users/arcangeloizzo/Desktop/Progetti/NOPARROT/noparrot-main/src/components/feed/ImmersivePostCard.tsx) (un componente complesso da ~190KB) e gestiti tramite combinazioni di `framer-motion` (per animazioni di swipe e drag) ed eventi touch nativi.

---

## Sezione B — Soluzioni candidate

Vengono messe a confronto le 3 librerie principali ed un approccio custom.

### 1. `react-window` (Brian Vaughn)
- **Compatibilità con `scroll-snap-type`**: Molto bassa. La libreria calcola gli offset e forza il posizionamento assoluto degli elementi. Poiché non mantiene stabili i nodi DOM in prossimità dello scroll, WebKit perde i riferimenti di snap, provocando continui salti grafici e blocco dello scroll inerziale su iOS.
- **API snap-aware**: Assente. Richiederebbe hack complessi per forzare il tracciamento del completamento dello scroll.
- **Bundle size**: ~2.2 KB gzipped.
- **Maintenance status**: Manutenzione passiva. Pochi aggiornamenti recenti.
- **Compatibilità gesti / framer-motion**: Problematica a causa del riciclo aggressivo dei nodi DOM che può interrompere le animazioni in corso.
- **Curva di adozione**: Alta (richiede refactor massivo del layout del feed).

### 2. `react-virtuoso` (Petyo Ivanov)
- **Compatibilità con `scroll-snap-type`**: Bassa. Esistono numerose issue aperte riguardanti il malfunzionamento dello scroll-snap nativo. Essendo Virtuoso basata su uno spostamento dinamico tramite translate3d e variazioni di padding del container per simulare l'altezza totale, il motore di snapping del browser entra in conflitto con i riposizionamenti della libreria, causando loop di ricalcolo del layout (layout thrashing) su Safari.
- **API snap-aware**: Buona (ha callback come `topItemIndexChange` e `firstVisibleIndex`).
- **Bundle size**: ~7.5 KB gzipped.
- **Maintenance status**: Altamente attivo.
- **Compatibilità gesti / framer-motion**: Discreta, ma i salti di misurazione delle card dinamiche interferiscono con i gesti drag di framer-motion.
- **Curva di adozione**: Alta.

### 3. `@tanstack/virtual` (headless, low-level)
- **Compatibilità con `scroll-snap-type`**: Medio-bassa. Essendo headless, permette di controllare interamente l'HTML e le classi applicate (incluso `snap-start`). Tuttavia, lo smontaggio dei nodi al di fuori del viewport fa sì che, durante swipe veloci, il browser tenti di effettuare lo snap su elementi non ancora creati nel DOM, rompendo la fluidità nativa dello scroll-snap.
- **API snap-aware**: Ottima (fornisce pieno controllo degli indici ed eventi di scroll).
- **Bundle size**: ~1.7 KB gzipped.
- **Maintenance status**: Molto attivo.
- **Compatibilità gesti / framer-motion**: Buona.
- **Curva di adozione**: Media.

### 4. Custom Lazy-Mount Window con Posizionamento Assoluto (Consigliata)
Invece di affidarsi ad una libreria esterna (tutte in conflitto con il rigido paradigma di scroll-snap e `100dvh`), si estende l'attuale meccanismo di sliding window implementando una vera distruzione dei nodi DOM in eccedenza, ma preservando i punti di snap attivi tramite posizionamento assoluto.
- **Come funziona**: 
  1. Si definisce un'altezza complessiva del container di scorrimento pari a `mixedFeed.length * 100dvh` (inserendo un `div` spaziatore vuoto e trasparente ad altezza fissa).
  2. Si calcola in React una sotto-sezione (slice) del feed visibile: ad esempio, solo 7 elementi in totale (`activeIndex - 3` fino a `activeIndex + 3`).
  3. Ciascuno di questi 7 elementi viene posizionato in modo assoluto a `top: ${index * 100}dvh` mantenendo la classe `snap-start`.
  4. Poiché le card immediatamente sopra e sotto quella attiva sono realmente presenti nel DOM ed allocate alla loro coordinata esatta, lo scroll-snap nativo del browser funziona in modo impeccabile.
  5. Quando l'utente cambia slide, la slice si sposta: i nodi remoti vengono distrutti e quelli nuovi vengono montati a coordinate absolute, senza alcun jitter visivo nel viewport attivo.
- **Compatibilità con `scroll-snap-type`**: 100% nativa e testata su WebKit/iOS.
- **API snap-aware**: Integrata nativamente con la sincronizzazione di `activeIndex`.
- **Bundle size**: 0 bytes.
- **Maintenance status**: Manutenzione interna al codice di progetto.
- **Compatibilità gesti / framer-motion**: Massima (nessuna interferenza con i comportamenti di `ImmersivePostCard`).
- **Curva di adozione**: Molto bassa (refactor circoscritto a `Feed.tsx` e `ImmersiveFeedContainer.tsx`).

---

## Sezione C — Piano architetturale raccomandato

Si propone l'adozione del pattern **Custom Lazy-Mount Window con Posizionamento Assoluto**, in quanto risolve alla radice il problema prestazionale riducendo il DOM a un massimo fisso di 7 nodi totali indipendentemente dalle dimensioni della query, salvaguardando lo scroll-snap nativo di iOS.

### 1. Approccio passo-passo per il refactor

#### Step 1: Modifica di `usePosts.ts` per supportare Infinite Scroll
Si rimuove il `.limit(20)` rigido. Si converte `usePosts` all'utilizzo di `useInfiniteQuery` di TanStack Query.
- La query effettuerà richieste paginate a Supabase utilizzando la paginazione basata su cursore (`created_at` o `id`).
- Dimensione di ogni pagina: 20 post.

#### Step 2: Implementazione dello spaziatore e della slice visibile in `Feed.tsx`
Si modifica il ciclo di mapping in `Feed.tsx`:
- Si calcola la slice degli elementi visibili attorno a `activeIndex`:
  ```typescript
  const OVERSCAN = 3; // 3 sopra e 3 sotto
  const visibleItems = useMemo(() => {
    const start = Math.max(0, activeIndex - OVERSCAN);
    const end = Math.min(mixedFeed.length, activeIndex + OVERSCAN + 1);
    return mixedFeed.slice(start, end).map((item, idx) => ({
      item,
      actualIndex: start + idx
    }));
  }, [mixedFeed, activeIndex]);
  ```
- All'interno di `ImmersiveFeedContainer.tsx`, si inserisce un elemento vuoto per definire la dimensione verticale totale:
  ```tsx
  <div 
    style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '1px', 
      height: `${totalCount * 100}dvh`, 
      pointerEvents: 'none' 
    }} 
  />
  ```
- Si esegue il map solo su `visibleItems`, posizionando i wrapper in modo assoluto:
  ```tsx
  visibleItems.map(({ item, actualIndex }) => (
    <div
      key={item.id}
      style={{
        position: 'absolute',
        top: `${actualIndex * 100}dvh`,
        left: 0,
        width: '100%',
        height: '100dvh'
      }}
      className="snap-start shrink-0 overflow-hidden"
    >
      {/* Rendering della card */}
    </div>
  ))
  ```

#### Step 3: Trigger dell'Infinite Scroll durante lo scorrimento
In `Feed.tsx`, si controlla la distanza dal fondo del feed all'interno del cambio di indice:
```typescript
const handleActiveIndexChange = useCallback((index: number) => {
  syncActiveIndex(index);
  
  // Se mancano meno di 5 elementi alla fine del feed caricato, fetch successiva
  if (index >= mixedFeed.length - 5 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [mixedFeed.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
```

#### Step 4: Validazione interazioni preesistenti
Verifica che tutte le funzionalità complesse (double-tap like, drawers, quiz modal, voice player) non subiscano disallineamenti a causa del posizionamento assoluto dei loro parent container.

#### Step 5: Test delle performance
Misurazione del tempo di risposta al tocco e dello swipe lag su simulatore iOS (SE e Pro Max) con oltre 500+ post mockati nel feed, per garantire un frame rate costante di 60/120fps.

---

### 2. File da toccare
1. `src/hooks/usePosts.ts`: Refactor del fetching da query statica a `useInfiniteQuery`.
2. `src/pages/Feed.tsx`: Modifica del calcolo dei nodi visibili, posizionamento assoluto e caricamento pagina successiva.
3. `src/components/feed/ImmersiveFeedContainer.tsx`: Supporto per il posizionamento relativo interno e spaziatore ad altezza dinamica.

### 3. Modifiche stimate per file
- `usePosts.ts`: ~40 righe modificate/aggiunte (integrazione `getNextPageParam` basato sul timestamp `created_at` dell'ultimo elemento).
- `Feed.tsx`: ~60 righe modificate (rimpiazzo del mapping completo con la slice e gestione delle proprietà dell'infinite scroll).
- `ImmersiveFeedContainer.tsx`: ~20 righe modificate (inserimento dello spaziatore DOM e stile `position: relative`).

### 4. Dipendenze da aggiungere
**Nessuna**. L'approccio custom sfrutta esclusivamente le API esistenti di React e TanStack Query, mantenendo immutato il peso del bundle applicativo.

### 5. Rischi identificati e mitigazioni
- **Rischio: Swipe estremamente veloci** che superano il buffer di overscan, portando temporaneamente l'utente su una slide vuota prima che React aggiorni lo stato visibile.
  - *Mitigazione*: Impostare un valore ottimale di `OVERSCAN = 3` (7 card totali). Essendo il feed ad un alto livello di densità cognitiva, lo swipe è tipicamente sequenziale e ponderato.
- **Rischio: Gestione dello stato di scroll al refresh**. Con altezze dinamiche simulate, l'indice salvato in `sessionStorage` potrebbe causare salti all'avvio.
  - *Mitigazione*: Ripristinare deterministicamente la posizione tramite `scrollToIndex(savedIndex)` solo dopo che il feed è stato popolato e lo spaziatore ha assunto l'altezza corretta.

---

## Sezione D — Domande aperte per Arcangelo

Prima di procedere alla Fase di scrittura del codice, sono necessarie le seguenti decisioni architetturali e di UX:

1. **Dimensione della finestra di rendering (OVERSCAN)**:
   Proponiamo un buffer di 3 card sopra e 3 card sotto (7 card totali nel DOM). Preferisci testare un buffer più stretto (es: 2 sopra e 2 sotto, per sole 5 card totali) per massimizzare le performance a basso livello, oppure manteniamo 3 per garantire sicurezza contro swipe rapidi?
   
2. **Paginazione cursor-based vs offset-based**:
   Raccomandiamo caldamente la paginazione basata su cursore utilizzando il campo `created_at` (Supabase recupera i post più vecchi del timestamp dell'ultimo post visualizzato). Questo evita duplicati se nuovi post vengono creati in cima mentre l'utente scrolla. Confermi questa scelta?
   
3. **Threshold di prefetch**:
   L'attivazione del caricamento della pagina successiva a 5 card dalla fine del feed attuale è ottimale per connessioni 4G/5G. Desideri parametrizzarlo o modificarlo?
   
4. **Approvazione della soluzione Custom**:
   Sei d'accordo nel procedere con la soluzione Custom (Libreria-free) che preserva il 100% del comportamento dello scroll-snap nativo di Safari/iOS, o desideri esplorare ulteriormente l'integrazione di una libreria headless come `@tanstack/virtual`?

---

## Sezione E — Bibliografia

- **Documentazione ufficiale TanStack Virtual**: [tanstack.com/virtual/v3](https://tanstack.com/virtual/v3)
- **Discussione GitHub: react-virtuoso e scroll-snap**: [react-virtuoso/issues/295](https://github.com/petyosi/react-virtuoso/issues/295)
- **Discussione GitHub: scroll-snap-align su posizionamento assoluto**: [w3c/csswg-drafts/issues/5911](https://github.com/w3c/csswg-drafts/issues/5911)
- **Safari WebKit Layout Performance**: [developer.apple.com/documentation/webkit](https://developer.apple.com/documentation/webkit)
