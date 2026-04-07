
Obiettivo

Ripristinare il feed come negli screenshot “prima”: stesso respiro laterale percepito e più spazio verticale sopra il blocco profilo e sotto la action bar, senza toccare i titoli.

Cosa ho verificato

- In `src/components/feed/ImmersivePostCard.tsx` il content rail è già `px-5` alla riga ~1773. Quindi il fix approvato è già presente, ma da solo non può riportare il layout “come prima”.
- Il mismatch visivo rimasto viene da due cause:
  1. alcuni wrapper interni continuano a stringere o falsare il rail (`px-1`, `max-w-md mx-auto`, `max-w-lg mx-auto`);
  2. i rail alto/basso hanno troppo poco respiro rispetto a header globale e navbar (`pt-[calc(env(safe-area-inset-top)+42px)]` in alto, `pb-[calc(4rem+env(safe-area-inset-bottom)+12px)]` in basso).

Piano di intervento

1. Ripristinare la spaziatura verticale del guscio della card in `ImmersivePostCard.tsx`
- aumentare il distacco tra header globale e riga profilo intervenendo sul rail superiore (blocco ~1605-1606);
- aumentare il distacco tra action bar e navbar intervenendo sul rail inferiore (blocco ~2581-2582);
- lasciare invariati titolo, font e tipografia.

2. Uniformare davvero il padding laterale percepito
- mantenere `px-5` sul rail principale;
- rimuovere o neutralizzare i micro-offset interni `px-1` che oggi cambiano il bordo percepito dei blocchi contenuto;
- punti principali in `ImmersivePostCard.tsx`: wrapper testo/media/poll attorno a ~1835, ~1897, ~1921, ~2007, ~2039, ~2073, ~2567.

3. Eliminare i vincoli di larghezza che rendono alcuni post più stretti di prima
- sostituire i wrapper centrati `max-w-md mx-auto` / `max-w-lg mx-auto` con contenitori allineati al rail quando il post deve occupare la larghezza piena del feed;
- punti principali:
  - `ImmersivePostCard.tsx` ~1944 (text-only card),
  - ~2087 (X card),
  - ~2186 (YouTube card),
  - `src/components/feed/post-bodies/LinkedInCard.tsx` riga ~16.
- risultato atteso: media, preview e card social devono partire dalle stesse linee di allineamento di avatar e bottone “Condividi”.

4. Verifica finale
- confrontare i due post esempio prima/dopo;
- controllare questi 4 aspetti:
  - bordo sinistro coerente tra profilo, titolo, media e share;
  - più spazio tra header globale e profilo;
  - più spazio tra action bar e navbar;
  - nessuna modifica ai titoli.

Dettagli tecnici

- File principale: `src/components/feed/ImmersivePostCard.tsx`
- File secondario da riallineare: `src/components/feed/post-bodies/LinkedInCard.tsx`
- Nessuna modifica a contenuti, titoli o logica dati: solo layout e spacing.
