
Ho ricontrollato il codice: no, il padding laterale “come prima” non è davvero stato ripristinato.

Diagnosi
- In `src/components/feed/ImmersivePostCard.tsx` il `px-6` c’è già su header/content/action rail (`1606`, `1773`, `2582`), quindi il problema non è “manca il padding” ma “è applicato nel punto sbagliato”.
- I tre rail sono ancora overlay assoluti agganciati ai bordi dello schermo (`top-0 left-0 right-0`, `absolute inset-0`, `bottom-0 left-0 right-0`), mentre il wrapper principale della card resta full-bleed (`h-[100dvh] w-full ... overflow-hidden`).
- Quindi oggi stiamo solo aggiungendo spazio interno ai rail, ma non stiamo ricreando l’inset laterale reale che avevi prima.
- In più alcuni fix successivi falsano la composizione: ci sono wrapper/CTA con `items-center` e `mx-auto` che compensano male e fanno sembrare testo, preview e immagini “spostati”.

Piano
1. Ripristinare il gutter al livello corretto
- In `ImmersivePostCard.tsx` introdurre/ripristinare un inner shell full-height con inset laterale fisso equivalente al layout precedente.
- Spostare dentro questo shell header rail, content rail e action rail, invece di lasciarli edge-to-edge sul viewport.
- Così avatar, titolo, media, pulsante “Condividi” e action icon erediteranno lo stesso padding reale.

2. Riallineare i blocchi che oggi bypassano quel gutter
- Sempre in `ImmersivePostCard.tsx`, togliere i compensatori introdotti nei tentativi precedenti (`mx-auto`, centrature forzate, eventuali allineamenti puntuali) dove rompono il bordo percepito.
- Lasciare che media, preview e CTA si allineino al nuovo shell, non a fix separati per singolo blocco.
- Verificare in particolare: media singolo, gallery, preview link generica, CTA “Apri su X”, CTA “Apri su YouTube”.

3. Toccare `LinkedInCard.tsx` solo se necessario
- Se il blocco LinkedIn continua a ignorare il nuovo gutter, riallineare anche `src/components/feed/post-bodies/LinkedInCard.tsx` allo stesso shell.
- Nessun cambio grafico ai titoli.

4. Vincolo esplicito
- Nessuna modifica a font, dimensioni, peso, uppercase, interlinea o stile dei titoli.

5. Verifica prima di confermare
- Confrontare il risultato con gli screenshot allegati prima di dichiarare il fix chiuso.
- Checklist:
  - stesso spazio laterale percepito dei post di qualche giorno fa;
  - stesso bordo sinistro tra profilo, titolo, media e pulsante “Condividi”;
  - nessun decentramento di testo, titoli o immagini;
  - titoli invariati.

File coinvolti
- `src/components/feed/ImmersivePostCard.tsx`
- `src/components/feed/post-bodies/LinkedInCard.tsx` solo se il CTA/link resta fuori asse.
