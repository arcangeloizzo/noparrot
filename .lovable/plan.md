
# Redesign shell — Profilo / Messaggi / Cerca / Notifiche

Il feed, il reader e il gate NON vengono toccati. Tutto il resto del wrapper esterno delle quattro pagine viene riscritto secondo la grammatica descritta.

## Fase 0 — Fondamenta comuni (una sola volta)

**`index.html`**
- Aggiungere il preconnect + il link a Google Fonts per **JetBrains Mono** (400/500/700). Anton è già caricato.

**`src/index.css`**
- Esporre come CSS var i colori dei territori riusando il mapping già in `src/config/categories.ts`:
  `--t-cultura:#A78BFA; --t-scienza:#2AD2C9; --t-tecnologia:#0A7AFF; --t-ambiente:#22C55E; --t-benessere:#F472B6; --t-societa:#E41E52; --t-politica:#FFD464; --t-economia:#F97316;`
  *(La spec chiede Scienza `#2AD2C9` e Economia `#F97316`: i valori dei filtri per il feed restano quelli di `categories.ts`; le var qui sono per la shell.)*
- Nuove utility (una sola volta, condivise):
  - `.shell-page` — fondo `var(--base)`, padding bottom nav, min-h dvh.
  - `.shell-header` — sticky, gradiente `var(--base) → transparent`, `h1` in Anton uppercase 30px allineato a sinistra.
  - `.shell-title` — Anton 30px uppercase, letter-spacing tight.
  - `.mono-eyebrow` — mono 10px uppercase, `--txt-3`, letter-spacing .1em.
  - `.pill-filter` / `.pill-filter[data-active="true"]` — 32px, radius 16px, ricetta glass che già vive in `.liquid-nav-item`.
  - `.row` — margin lat. 22px, radius 18px, fondo `rgba(255,255,255,.035)`, bordo `rgba(255,255,255,.08)`, padding `14px 16px 14px 18px`; **posiziona la costola** come `::before` di 2px full-height con gradiente verso trasparente. Colore via CSS var `--rib` (default `rgba(255,255,255,.14)`).
  - `.row[data-unread="true"]` — fondo `rgba(10,122,255,.09)`, bordo `rgba(10,122,255,.22)`, `--rib: var(--blue)` + glow.
  - `.hairline` — 1px `rgba(255,255,255,.08)`.
- `@media (prefers-reduced-motion)` — sopprime shimmer/rotazioni dove necessario.

**Nuovo `src/lib/territory.ts`** (fonte unica)
- `getTerritoryColor(name: string): string | undefined` — usa `normalizeCategory` + il mapping esistente, esposto anche come nome della var (`--t-cultura`).
- `getTerritoryCssVar(name)` → stringa `var(--t-…)`.

**Nuovo `src/components/shell/Row.tsx`**
- Primitiva condivisa: `<Row rib="scienza"|"blue"|"neutral"|"gradient" unread? onClick>{icon, title, meta, right}</Row>`.
- Usata identica da Diario, Messaggi (thread), Cerca (trend + persone), Notifiche.

## Fase 1 — Messaggi (lift più contenuto)

- **`src/pages/Messages.tsx`**: header Anton "MESSAGGI" a sinistra, icona nuova conversazione a destra (rimuove back+centrato). Campo ricerca in vetro h46 radius 23. Rail filtri **Tutti / Non letti · N / Gruppi**.
- **`src/components/messages/ThreadList.tsx`**: usa `<Row>` con avatar 50px, costola blu+glow se non letta, anteprima singola riga con "Tu:" più tenue, ora in mono 9.5px, badge numerico blu a destra per non letti. Groups: due avatar 34px impilati in diagonale, nome "Nome, Nome". Indicatore online 13px con bordo 2.5px `var(--base)`.
- `ThreadListSkeleton` ridimensionato a 50px.

## Fase 2 — Notifiche

**`src/pages/Notifications.tsx`** riscritto:
- Header Anton "NOTIFICHE"; "Segna tutte ✓✓" in alto a destra, testo mono blue-l, non pill.
- Rail filtri **Tutte / Menzioni / Comprensioni / Reazioni** (filtro client-side su `type`).
- Raggruppamenti "Questa settimana / Precedenti" (semplificato) con `.mono-eyebrow` + hairline che occupa lo spazio residuo; "N nuove" a destra in blue-l.
- Riga = `<Row>`. Avatar 34px con badge 20px del tipo in basso a destra (bordo 2px `var(--base)`).
- Colori icona: comment blu, like #E41E52, mention #FFD464, reshare #4DA3FF, gate/challenge #2AD2C9.
- Snippet come blocco annidato `rgba(255,255,255,.045)` r12 clamp 2; menzioni in blue-l via regex `@\w+`.
- Non letto = costola blu + fondo blu tenue; pallino attuale rimosso.

## Fase 3 — Cerca (la vera rifatta)

**`src/pages/Search.tsx`** — nuovo layout di *scoperta*:
- Header Anton "CERCA" + campo vetro placeholder "Cerca discussioni, persone, fonti".
- Rail territori orizzontale scrollabile con pill mono + pallino colore pianeta; prima pill "Tutto".
- Sezione **"Di cosa parla la community"**: righe di trend con numero d'ordine in Anton 22px `--txt-4`, titolo + meta mono + sparkline SVG 5 barrette colorate. Metrica = comprensioni (usa `useTrendingTopics` esistente, campo `unique_users` → rename etichetta).
- Sezione **"Persone da seguire"**: usa `usePopularTopics`/query esistente sui profili; avatar 42px, meta mono con due territori dominanti e comprensioni, bottone "Segui" bianco su scuro (integra `useFollow`).
- Sezione **"Territori inesplorati"**: bordo tratteggiato, elenca i pianeti dove l'utente ha 0 comprensioni (query cognitive density → complement). Copy come da spec. Le pill fanno navigate a `/search?t=cultura`.
- **Fallback**: se trend vuoti, li nasconde e sale "Territori inesplorati". Zero stato "Torna più tardi".
- Ricerca digitata → mantiene comportamento attuale di `SearchResults` senza toccarlo.

## Fase 4 — Profilo

**`src/pages/Profile.tsx`** header + hero + statistiche + pulse + nebulosa + diario:
- Nome Anton 27px 2 righe uppercase, handle mono, bio corsivo `--txt-4`.
- Avatar 74px con anello gradiente `cultura → scienza → blue` (nuovo componente locale `AvatarRingedHero`, oppure aggiornamento di `AvatarWithRing` con variante `hero`).
- **Hero counter**: "N cose / COMPRESE" — Anton 62px con gradiente text da bianco al colore territorio dominante. Territorio dominante letto da `useCognitiveDensity` (top).
- Tris statistiche in tre celle con hairline verticali (`territori / segui / ti seguono`).
- **`src/components/profile/PulseCard.tsx`**: aggiorna al materiale reale — `.np-glass` + `.np-grain`, costola bicolore (gradiente due territori citati), eyebrow "PULSE DELLA SETTIMANA" con pallino verde luminoso, footer hairline con "Esplora correlati →" in mono blue-l.
- **`src/components/profile/CompactNebula.tsx`** wrapper: header Anton 15px + pill fantasma "Espandi ⤢"; etichette pianeti mono 8.5px uppercase.
- **`src/components/profile/DiaryEntry.tsx` + `DiaryFilters.tsx`**: pill mono; ogni voce = `<Row>` con icona tipizzata 34px quadrata r11 fondo 14% del colore tipo + label tipo mono colorata + titolo Inter 14.5px + meta mono; costola del colore territorio.

## Non tocco
- Feed (`ImmersivePostCard`, embeds, `FullTextModal`, `MediaMosaic`, `CommentsDrawer`).
- Gate (`comprehension-gate*`, `QuizModal`, `SourceReaderGate`).
- Composer.
- `src/integrations/supabase/*`.

## Verifica
- `bunx tsgo --noEmit`.
- Sanity a 360px sulle quattro pagine via Playwright headless (screenshot).
- Nessuna regressione visiva sul feed (non tocco quei file).

## Consegna finale
Elenco dei file creati/modificati + esito typecheck.
