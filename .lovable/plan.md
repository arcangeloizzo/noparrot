
Problema confermato

- Sì: il padding laterale “come prima” non è ancora ripristinato.
- Nel codice attuale è stato insettato davvero solo il content rail (`left-6 right-6` in `src/components/feed/ImmersivePostCard.tsx`), mentre header e action rail sono ancora full-width (`top-0 left-0 right-0` / `bottom-0 left-0 right-0`) con solo `px-6` interno.
- Quindi il gutter reale non esiste ancora a livello di card: esiste solo come spazio interno di alcuni blocchi.
- In più restano compensazioni locali che falsano il layout (`mx-auto` sulle CTA, `items-center` su alcune preview), ed è per questo che in alcuni casi testo e immagini sembrano fuori asse.

Piano corretto

1. Ripristinare il gutter al livello giusto
- In `src/components/feed/ImmersivePostCard.tsx` introdurre un inner shell unico, full-height, con inset laterale fisso uguale al layout precedente.
- Mettere dentro questo shell tutti e tre i rail:
  - header
  - content
  - action bar
- Lasciare full-bleed solo background e fade, non i contenuti interattivi.

2. Riallineare i blocchi che oggi bypassano il gutter
- Sempre in `ImmersivePostCard.tsx`, rimuovere i compensatori introdotti nei tentativi precedenti:
  - `mx-auto` su “Apri su X”
  - `items-center` sul container preview generica
  - altri centraggi puntuali solo dove rompono il bordo comune
- Obiettivo: avatar, titolo, media, preview e pulsante “Condividi” devono partire tutti dallo stesso bordo sinistro.

3. Correggere il sottocomponente che resta fuori asse
- Verificare `src/components/feed/post-bodies/LinkedInCard.tsx`, perché oggi il CTA è ancora `mx-auto`.
- Toccarlo solo se, dopo il nuovo shell, continua a risultare disallineato.

4. Non toccare i titoli
- Nessuna modifica a font, dimensioni, peso, uppercase, line-height o stile dei titoli.

5. Verifica finale obbligatoria
- Confronto diretto con gli screenshot annotati prima di chiudere il fix.
- Checklist:
  - stesso padding laterale percepito dei post di qualche giorno fa;
  - stesso bordo sinistro tra profilo, titolo, media e share;
  - più spazio sopra il blocco profilo;
  - più spazio sotto la action bar verso la navbar;
  - nessun decentramento di testi o immagini.

Riferimento interno utile
- `src/components/feed/ImmersiveEditorialCarousel.tsx` ha già il pattern giusto: il gutter è applicato al wrapper della slide (`px-6`), non come compensazione interna ai singoli rail. Userò quello come riferimento visivo/strutturale, senza modificarlo.

File coinvolti
- `src/components/feed/ImmersivePostCard.tsx`
- `src/components/feed/post-bodies/LinkedInCard.tsx` solo se necessario
