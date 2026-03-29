
Obiettivo: correggere 3 problemi collegati ma distinti: il sondaggio non viene persistito/reso visibile, il composer mobile continua a bloccare la pubblicazione in alcuni flussi title-only, e il toast “Condiviso.” resta troppo a lungo.

1. Verifica e fix del salvataggio sondaggio
- Il problema principale non è il rendering del widget: il database oggi non contiene record in `polls` / `poll_options`, quindi il feed non ha nulla da mostrare.
- Dai log del backend risulta che i post vengono creati, ma non compare alcun log di creazione poll: questo indica che `pollData` non sta arrivando al backend nei casi reali usati dall’utente, oppure arriva vuoto nel momento della publish.
- Implementazione proposta:
  - fare snapshot esplicito di `pollData` dentro `publishPost()` insieme a content/media/url per evitare perdita di stato durante il flusso async;
  - aggiungere logging client e backend mirato su `hasPoll`, numero opzioni e payload inviato;
  - usare sempre lo snapshot del poll nel body inviato a `publish-post`;
  - creare anche `poll` ottimistico nel cache post-publish, così il widget può apparire subito senza aspettare refetch.

2. Fix rendering post pubblicati con sondaggio
- Una volta sistemata la persistenza, il widget va mostrato in tutti i layout già previsti:
  - `ImmersivePostCard`
  - `DesktopPostCard`
  - `QuotedPostCard` in read-only
- Miglioria necessaria:
  - `usePollForPost` oggi è `enabled: !!postId && !!user`; questo nasconde il poll quando l’auth non è ancora pronta o in alcuni stati del feed. Va reso indipendente dal fatto che l’utente sia già caricato, lasciando opzionale solo il lookup del voto personale.
  - aggiungere fallback UI per `poll` senza voto utente.

3. Fix title-only publishing nel composer mobile
- Il backend ormai consente post con solo titolo (`allowEmpty` include `title`), quindi il blocco è lato UI.
- Nel composer mobile il bottone Pubblica appare solo se `composerMode === 'text-editing'`; il titolo può far tornare il composer in `idle` su blur e quindi sparire il bottone anche se il titolo è valido.
- Implementazione proposta:
  - mantenere il composer in `text-editing` se esiste `postTitle`, `content`, media, voice o poll;
  - far comparire il bottone Pubblica anche in `idle` quando esiste contenuto pubblicabile;
  - centralizzare una funzione unica `hasPublishableContent` riusata per visibilità bottone, disabled state, close-confirm e guard di `handlePublish`.

4. Fix toast “Condiviso.”
- Il toast visibile nello screenshot è Sonner, non il sistema custom `use-toast`.
- `src/components/ui/sonner.tsx` ha durata globale 3000ms; alcuni flussi usano 1800ms ma non tutti, e il layout top-center può far percepire il toast come “bloccato”.
- Implementazione proposta:
  - ridurre la durata globale Sonner a un valore più breve coerente;
  - mantenere override esplicito nel publish success;
  - eliminare eventuali toast concorrenti successivi che possono riaprire o estendere la percezione del messaggio;
  - correggere anche il vecchio `use-toast` interno (`TOAST_REMOVE_DELAY = 1000000`) per evitare futuri problemi in altre schermate.

5. Controlli tecnici sul backend
- Aggiornare `publish-post` con log chiari:
  - `hasPollData`
  - `pollOptionsCount`
  - `stage=poll_created`
  - `stage=poll_skipped_invalid`
- Validare che le opzioni filtrate siano almeno 2 dopo `trim`.
- Se il poll insert fallisce, restituire warning più leggibile nei log invece di silenziarlo soltanto.

6. QA dopo implementazione
- Creare un post con solo titolo e verificare che pubblichi.
- Creare un post con titolo + sondaggio e corpo vuoto.
- Creare un post con corpo + sondaggio.
- Verificare che le opzioni compaiano subito nel feed mobile e desktop.
- Verificare che il toast “Condiviso.” scompaia rapidamente senza richiedere altre azioni.
- Verificare che i sondaggi persistano dopo refresh.
- Verificare che in reshare il poll venga mostrato correttamente e resti compatibile col gate.

Dettagli tecnici
- File sicuramente da aggiornare:
  - `src/components/composer/ComposerModal.tsx`
  - `src/components/feed/ImmersivePostCard.tsx`
  - `src/components/feed/DesktopPostCard.tsx`
  - `src/components/feed/QuotedPostCard.tsx`
  - `src/hooks/usePollVote.ts`
  - `src/components/ui/sonner.tsx`
  - `src/hooks/use-toast.ts`
  - `supabase/functions/publish-post/index.ts`
- Evidenza raccolta:
  - query DB su `polls` oggi restituisce array vuoto;
  - i log recenti di `publish-post` mostrano creazione post title-only riuscita, ma nessuna traccia della sezione poll;
  - il backend accetta già `title` senza body, quindi il problema restante è di stato/UI nel composer.
