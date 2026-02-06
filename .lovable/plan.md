
Obiettivo (come richiesto)
- Tornare subito a `justify-center` nelle card immersive.
- Rimuovere tutti i `max-h` “calcolati” (quelli con `min(...)` e simili) introdotti di recente.
- Nuova regola unica: se (e solo se) il contenuto non entra nella viewport, ridimensionare soltanto l’immagine (in modo proporzionale), senza toccare testo/azioni/altri blocchi.

Perché oggi è “un disastro” (razionale tecnico)
1) `justify-start` + `gap-4` fa partire tutto dall’alto: quando il contenuto è corto, lascia “buchi” sotto; quando è lungo, spinge in basso e aumenta il rischio di sovrapposizioni percepite (specie se qualche area non è realmente “riservata”).
2) I `max-h-[min(...)]` su MediaGallery sono troppo aggressivi: comprimono immagini anche quando ci sarebbe spazio, perché il vincolo è applicato sempre, non solo quando serve.
3) Il sistema attuale non “sa” quando sta overflowando: applica regole statiche senza misurare l’altezza realmente disponibile.

Strategia definitiva (semplice e controllabile)
A) Revert immediato layout verticale
- In entrambe le card immersive:
  - Ripristinare `justify-center` nel wrapper centrale.
  - Mantenere `min-h-0` (serve a far funzionare bene il flex in altezza).
  - Non reintrodurre `overflow-hidden` globale sul wrapper centrale (taglia “a forbice”); al massimo lo useremo solo su blocchi specifici che devono restare confinati, ma la richiesta attuale dice “non toccare nient’altro”, quindi lo evitiamo.

B) Eliminare tutti i `max-h` calcolati introdotti
- In `src/components/media/MediaGallery.tsx`:
  - Rimuovere:
    - `max-h-[min(30vh,240px)] ... [@media(...)]:max-h-[min(...)] ...`
  - Non sostituirli con altri vincoli “sempre attivi”.
- In `src/components/feed/ImmersivePostCard.tsx`:
  - Rimuovere la wrapper limitante del quoted:
    - da `max-h-[min(35vh,280px)] ...` a nessun `max-h` (o, se necessario per sicurezza, un overflow controllato solo quando in overflow; vedi punto C).
- In `src/components/feed/ImmersiveFocusCard.tsx`:
  - Non ci sono media, quindi qui la parte “max-h calcolati” non si applica; ci limitiamo al revert di `justify-center`.

C) Implementare la regola “se overflow, riduci solo l’immagine” con una misura reale (no euristiche)
Questa è la parte cruciale per evitare regressioni “random”.

1) Aggiungere una rilevazione overflow nel “Content Zone” della card (ImmersivePostCard)
- Inserire un ref sul Content Zone (il div `flex-1 ...`).
- Misurare se il content overflowa:
  - condizione: `el.scrollHeight > el.clientHeight + 1`
- Aggiornare una state boolean `isOverflowing`.
- Usare un `ResizeObserver` + listener su `window.resize` per aggiornare in modo affidabile:
  - quando cambia viewport
  - quando cambiano contenuti (es. immagini caricate, preview, font)

2) Quando `isOverflowing === true`, applicare un vincolo SOLO alle immagini (non al testo, non alle azioni)
- Questo vincolo deve essere:
  - proporzionale (non crop): restiamo su `object-contain`
  - “solo se serve”: attivo solo in overflow
- Implementazione pratica:
  - Estendere `MediaGallery` per accettare una prop opzionale, per esempio:
    - `imageMaxHeightClass?: string`
  - Dentro `MediaGallery`, l’`img` userà:
    - classi base (w-full, object-contain, bg-black/40, ecc.)
    - + `imageMaxHeightClass` se presente
  - In `ImmersivePostCard`, passare:
    - `imageMaxHeightClass={isOverflowing ? "max-h-[25vh]" : undefined}`
  - Nota: `max-h-[25vh]` è coerente con la regola d’oro che avevi indicato (“su schermi piccoli l’immagine deve ridursi max-h-[25vh]”), ma qui lo applichiamo solo in overflow, quindi su Pro Max non verrà “castrato” se c’è spazio.

3) Coprire anche i casi “media-only post” (dove non passa da MediaGallery)
Nel file `ImmersivePostCard.tsx` ci sono immagini/video “media-only” con altezze fisse:
- immagini: `className="w-full h-[32vh] sm:h-[44vh] object-cover"`
- video thumb: `h-[28vh] sm:h-[38vh] object-cover"`
Questi possono causare overflow senza passare da MediaGallery.
Adeguamento minimale rispettando la regola “tocca solo l’immagine”:
- Quando `isOverflowing`:
  - sostituire l’altezza fissa con un vincolo max-height + `object-contain` (per non croppare)
  - esempio: `max-h-[25vh] object-contain` in overflow, altrimenti mantenere comportamento attuale (se vuoi mantenere “hero crop” quando c’è spazio).
Questo è l’unico punto dove “tocchiamo” lo styling dell’immagine, non il resto.

4) QuotedPostCard / media nel quoted
`QuotedPostCard` usa `MediaGallery`, quindi eredita automaticamente il comportamento se:
- Propaghiamo `imageMaxHeightClass` anche dentro `QuotedMediaCarousel` (piccola modifica):
  - `QuotedMediaCarousel` accetta `imageMaxHeightClass?: string`
  - `QuotedPostCard` lo passa in base al contesto
Scelta semplice (per non complicare troppo):
- In `ImmersivePostCard`, quando renderizzi il blocco quoted, passiamo al componente quoted (o al wrapper che lo contiene) una prop “overflowBudget” che scende fino a MediaGallery.
- Se non vogliamo toccare le prop chain adesso: alternativa pragmatic:
  - applicare la logica overflow solo alla MediaGallery del post principale (che è quella che in genere rompe la viewport)
  - e rimuovere il max-h dal wrapper quoted (così non tronca “a forbice”); il quoted ha già troncamento testo a 280 char + “Mostra tutto”, quindi rimane gestibile.
Io consiglio la prima (propagarla) solo se vediamo overflow ricorrente proprio per media nel quoted.

D) Tornare a `justify-center` anche in ImmersiveFocusCard (uniformità richiesta)
- In `src/components/feed/ImmersiveFocusCard.tsx`:
  - cambiare il Content Zone da `justify-start` a `justify-center`
  - mantenere `gap-4` (non fa danni) oppure ridurlo a `gap-3` se “respira” troppo; ma la tua richiesta dice “immediatamente”, quindi: solo revert a center, niente micro-tuning.

File coinvolti (con modifiche previste)
1) `src/components/feed/ImmersivePostCard.tsx`
- Content Zone: `justify-start` -> `justify-center`
- Rimuovere `max-h-[min(...)]` dal wrapper quoted (linee ~2009-2031)
- Aggiungere overflow detection (ref + state + ResizeObserver)
- Passare `imageMaxHeightClass` a `MediaGallery` quando `isOverflowing`
- Gestire anche immagini/video “media-only” ridimensionando solo l’immagine in overflow

2) `src/components/feed/ImmersiveFocusCard.tsx`
- Content Zone: `justify-start` -> `justify-center`

3) `src/components/media/MediaGallery.tsx`
- Rimuovere tutti i `max-h-[min(...)]` dagli `img`
- Aggiungere prop `imageMaxHeightClass?: string` e applicarla agli `img` quando presente

4) (Opzionale, solo se serve) `src/components/feed/QuotedPostCard.tsx`
- Se vogliamo budget anche sul media quoted: far passare `imageMaxHeightClass` fino al `MediaGallery` nel quoted carousel
- Altrimenti: nessuna modifica, dopo aver rimosso il max-h wrapper in ImmersivePostCard

Criteri di accettazione (test pratici)
1) iPhone Pro Max (viewport alta):
- Post con media: l’immagine non deve essere rimpicciolita se non c’è overflow.
- Il contenuto deve risultare centrato verticalmente (come richiesto).
2) iPhone mini / viewport bassa:
- Se un post “non entra”, l’unica cosa che cambia è l’immagine che si riduce (max-h ~25vh) mantenendo `object-contain`.
- Le azioni restano sempre cliccabili e visibili.
3) Nessun `max-h-[min(...)]` rimasto nel codice (MediaGallery e wrapper quoted ripuliti).
4) Nessun taglio brutale via `overflow-hidden` sul wrapper centrale.

Nota importante (per evitare un altro giro di caos)
Con questa strategia non stiamo più “indovinando” layout via regole statiche: misuriamo davvero quando c’è overflow e interveniamo solo sulla parte che hai autorizzato (immagine). Questo elimina sia:
- il caso “ho tantissimo spazio ma tutto è compresso”
- sia il caso “alcuni post si sovrappongono” (perché in overflow l’immagine si riduce e libera spazio)

Sequenza di implementazione (rapida, a rischio basso)
1) Revert `justify-center` (PostCard + FocusCard)
2) Ripulire MediaGallery dai max-h calcolati + aggiungere prop `imageMaxHeightClass`
3) Implementare overflow detection in ImmersivePostCard e collegarla a MediaGallery
4) Rimuovere max-h calcolato dal wrapper quoted
5) Verifica su 3 casi: (a) post corto con media (b) post lungo con media (c) reshare con quoted + media

Rollback safety
- Le modifiche saranno tutte localizzate a 2 componenti + MediaGallery.
- Se qualcosa non torna, possiamo disattivare l’overflow detection lasciando solo justify-center e la rimozione dei max-h calcolati, senza toccare il resto del feed.
