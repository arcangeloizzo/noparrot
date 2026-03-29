

# Piano: Multi-select sondaggi + centratura UI

## Panoramica
Due modifiche: (1) aggiungere l'opzione per il creatore del sondaggio di scegliere se permettere una sola preferenza o più di una; (2) centrare verticalmente il widget del sondaggio tra il testo e le action icons nel feed mobile.

---

## 1. Database — nuova colonna `allow_multiple`

Aggiungere una colonna booleana `allow_multiple` (default `false`) alla tabella `polls`. Rimuovere il vincolo `UNIQUE (poll_id, user_id)` su `poll_votes` e sostituirlo con un vincolo `UNIQUE (poll_id, user_id, option_id)` per permettere voti multipli quando abilitato.

---

## 2. Composer — toggle scelta singola/multipla

**File: `PollCreator.tsx`**
- Aggiungere `allowMultiple: boolean` all'interfaccia `PollData`
- Aggiungere un toggle UI (due chip "Scelta singola" / "Scelta multipla") sotto la sezione durata
- Default: scelta singola (`false`)

**File: `ComposerModal.tsx` + `DesktopComposer.tsx`**
- Inizializzare `allowMultiple: false` nel `PollData` di default
- Passare il campo nel payload verso il backend

---

## 3. Backend — persistenza e validazione

**File: `publish-post/index.ts`**
- Leggere `body.pollData.allowMultiple` e passarlo all'insert nella tabella `polls`

**File: `usePollVote.ts`**
- Aggiungere `allow_multiple` al tipo `PollData` restituito
- Nella fetch, leggere il campo dalla riga `polls`
- Nel `useVotePoll`: se `allow_multiple` è true, permettere inserimenti multipli (una riga per opzione); se false, mantenere la logica attuale (toggle/change vote singolo)
- Per il `user_vote_option_id`, restituire un array `user_vote_option_ids: string[]` quando multi-select

---

## 4. PollWidget — supporto multi-select

**File: `PollWidget.tsx`**
- Usare `poll.user_vote_option_ids` (array) invece di `user_vote_option_id` singolo
- Mostrare checkbox visuale invece di radio quando `allow_multiple` è true
- Permettere selezione/deselezione di più opzioni
- Mostrare risultati dopo il primo voto (come ora), ma permettere di continuare a votare altre opzioni

---

## 5. Layout — centratura verticale nel feed

**File: `ImmersivePostCard.tsx`**
- Spostare il blocco `PollWidget` all'interno del contenitore principale del post e usare `flex-grow` + `flex items-center justify-center` per centrarlo verticalmente nello spazio disponibile tra il testo del post e la barra azioni in basso
- Wrappare il contenuto testuale e il poll in un container flex-col con il poll che occupa lo spazio residuo centrato

---

## Dettagli tecnici

| Tipo | File |
|------|------|
| Migrazione DB | Nuova: add `allow_multiple` + fix unique constraint |
| Modifica | `src/components/composer/PollCreator.tsx` |
| Modifica | `src/components/composer/ComposerModal.tsx` |
| Modifica | `src/components/composer/DesktopComposer.tsx` |
| Modifica | `src/components/feed/PollWidget.tsx` |
| Modifica | `src/hooks/usePollVote.ts` |
| Modifica | `supabase/functions/publish-post/index.ts` |
| Modifica | `src/components/feed/ImmersivePostCard.tsx` |

