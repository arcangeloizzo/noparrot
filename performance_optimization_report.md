# Technical Report: Ottimizzazione Avanzata del Rendering e Scrolling (WebKit/iOS)

Questo documento fornisce un'analisi ingegneristica dettagliata dei colli di bottiglia architetturali risolti durante l'ottimizzazione del feed immersivo (stile TikTok) in React. L'obiettivo è fornire un reference tecnico utilizzabile per architetture simili, specialmente nello sviluppo di WebApp destinate a Safari iOS.

---

## 1. Executive Summary
**Problema:** Una WebApp React presentava un frame rate inaccettabile (<10 FPS) e blocchi dell'UI (fino a 1.6 secondi di *Main Thread blocking*) durante lo scroll verticale di un feed immersivo e lo swipe orizzontale di un carosello annidato. Il problema si presentava su device iOS di fascia alta con molta history, ma non su interfacce con pochi dati o dispositivi Android.

**Metodologia Diagnostica:** Sono state effettuate letture sequenziali dei file JSON esportati dal Web Inspector di Safari (Timeline Tab), isolando i tempi di `Script` (React/JS) e `Layout/Composite` (WebKit Rendering Engine). L'approccio è stato esclusivamente *data-driven*, utilizzando una strategia di sottrazione per confermare le ipotesi.

**Risultati:** 
- **Picco Max Layout/Frame:** Da 1645ms a 138ms.
- **Tempo Totale Layout/Composite:** Da ~8.300ms a 1.161ms.
- **Esecuzione JS Totale:** Da ~1.600ms a 271ms.

---

## 2. Analisi dei Colli di Bottiglia & Soluzioni Implementate

### Bottleneck #1: React Context Thrashing (JS Layer)
**Sintomatologia:** Tempi di esecuzione Script estremamente alti (~1.6 secondi).
**Root Cause:**
Il feed era costruito mappando un array di componenti pesanti (es. `ImmersivePostCard`). Ogni card consumava uno stato globale (l'indice attivo di scroll) tramite `useFeedContext()`. 
Durante lo scroll, il cambiamento di `activeIndex` provocava l'invalidazione simultanea di **tutte** le istanze montate, costringendo il Virtual DOM a ricalcolare l'intero albero per card che non erano nemmeno nella viewport.
**Soluzione:**
1. **Rimozione del Context:** Sostituito l'approccio Publish/Subscribe del Context con un classico passaggio di Props (`isActive`, `isNearActive`) pilotato dal container parent (`Feed.tsx`).
2. **Memoizzazione:** Avvolto il componente foglia in `React.memo` per fare bail-out dal rendering se le props di stato non cambiavano.
**Impatto:** Abbattimento del 50% del carico CPU sul thread JavaScript.

### Bottleneck #2: CSS Filter Composite Overload (GPU Layer)
**Sintomatologia:** Tempi di Layout e Composite elevati. Surriscaldamento del device.
**Root Cause (Il problema del Glassmorphism):**
Safari iOS non possiede l'ottimizzazione hardware di Chrome per il ricalcolo continuo dei pixel sfocati. L'utilizzo massiccio di `backdrop-filter: blur()`, `filter: blur()`, `drop-shadow` e `mix-blend-mode` su elementi o testi sovrapposti ad aree dinamiche costringe WebKit a degradare da *Hardware Compositing* a *Software Rasterization* (CPU rendering).
In particolare:
- Effetti `blur-2xl` giganti all'interno di elementi "scrollabili".
- Pallini di navigazione fissi in overlay (`fixed`/`absolute`) con `backdrop-blur` posti sopra un livello in scorrimento.
**Soluzione:**
1. Eliminazione o drastica riduzione di `drop-shadow` sui testi (una delle proprietà più lente in assoluto su iOS durante le trasformazioni geometriche).
2. Sostituzione dei `radial-gradient` complessi e `mix-blend-mode` con colori HEX solidi o PNG statici.
3. Isolamento degli strati opachi da quelli semitrasparenti per non forzare la GPU al ricalcolo della matrice ad ogni frame di `touchmove`.

### Bottleneck #3: Scroll-Snap DOM Depth Bug (WebKit Layout Engine)
**Sintomatologia:** Un singolo frame di Layout che impiega 1.6 secondi. Sensazione di UI "congelata" appena si tocca lo schermo. Questo bug affliggeva l'utente "storico" (50+ post) ma non i test su profili nuovi (5 post).
**Root Cause:**
Il core rendering engine di Safari ha una complessità asintotica sub-ottimale (`O(N)`) per le regole CSS `scroll-snap-type: y mandatory`. 
Quando il DOM container ospita decine di nodi figli con classe `snap-start`, e ciascuno di questi nodi ha un'altezza relativa gigantesca (`100dvh`), iOS calcola in modo sincrono le collisioni di snap per *ogni singolo nodo figlio* non appena il layout viene invalidato (es: inizio di uno scroll o mounting di un componente figlio di React).
Nonostante React svuotasse il *contenuto* delle card fuori viewport, i wrapper `div` con `100dvh` erano ancora attaccati all'albero DOM. A 50 iterazioni (5.000vh totali), il Main Thread collassa.
**Soluzione:**
L'introduzione di un hard `.limit(20)` sulla query DB ha abbattuto immediatamente il picco di layout. In architetture di produzione, la soluzione prevede:
- Implementazione di un vero **DOM Virtualizer** (es. `react-window`), che usa coordinate assolute `top/transform` su un unico grande container vuoto, smontando completamente i nodi DOM (`snap-start`) eccedenti, riducendo `N` a un massimo di 3 o 4 nodi DOM simultanei.

### Bottleneck #4: Hardware Acceleration in JS Carousels (Compositing)
**Sintomatologia:** Lag marcato durante l'interazione orizzontale (`touch-pan-x`), frame mediano bloccato a ~20 FPS.
**Root Cause:**
L'utilizzo di librerie JavaScript per la gestione dello scorrimento touch (es. Embla Carousel) non si appoggia allo scroll nativo (`overflow-x: scroll`), ma cattura gli eventi touch e inietta inline styles `transform: translate3d(...)` nel wrapper genitore. 
Se le singole slide (i nodi figli) non sono esplicitamente promosse a livelli hardware (GPU textures), Safari invia comandi di Repaint per ogni slide a ogni sub-pixel di trascinamento.
**Soluzione:**
Applicazione esplicita di *GPU Hinting* sulle singole card/slide (non sul wrapper). L'inserimento delle direttive Tailwind `transform-gpu will-change-transform` (che traducono in `will-change: transform; transform: translateZ(0)`) isola la geometria di ogni slide. La GPU esegue ora il panning traslando le texture pre-rasterizzate in memoria, raggiungendo i classici 60 FPS stabili.

---

## 3. Checklist Architetturale per Sviluppo Mobile Web (iOS Target)

Quando si costruiscono Feed in stile "TikTok / Reels" su tecnologie web:

1. **Mai affidarsi al CSS Snap senza Virtual DOM Destruction:** Se usi `scroll-snap-type`, devi assicurarti che nel DOM non esistano mai più di 3-5 nodi `snap-start` alti `100vh/dvh` per evitare crash di ricalcolo del layout engine.
2. **React Context Optimization:** Evita di agganciare dati ad altissima mutabilità (es. scroll index, coordinate, offset) in un React Context globale. Usa State Management atomico (es. Zustand), selettori precisi, o passa props controllate accoppiate a `React.memo`.
3. **GPU Layering Strategico:** Assicurati che ogni elemento o lista mossa via JavaScript (`transform: translate`) esponga un backing layer dedicato (`transform: translateZ(0)`).
4. **Budget dei Filtri Visivi:** Tratta `backdrop-filter`, `mix-blend-mode` e `drop-shadow` come operazioni estremamente costose. Non sovrapporre mai un elemento con `backdrop-filter` sopra un container che possiede una propria animazione di scrolling interna.
5. **Passive Event Listeners:** Quando usi custom hooks per interazioni (es. `useLongPress`), assicurati che gli handler dei `touchstart` e `touchmove` non contengano `e.preventDefault()` indiscriminati, per non abbattere il pass-through dell'hardware scrolling nativo.
