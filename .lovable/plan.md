

# Piano: Sondaggi nei Post

## Panoramica
Aggiungere sondaggi (2-8 opzioni, durata configurabile, voto modificabile) ai post standard e voicecast. Per votare, l'utente deve superare il gate se applicabile (stesse regole esistenti). Il Punto editoriale non può avere sondaggi, ma un reshare di un post con sondaggio segue le regole gate standard.

---

## 1. Database — 3 nuove tabelle + migration

### `polls`
| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| post_id | uuid NOT NULL UNIQUE | FK → posts(id) CASCADE |
| expires_at | timestamptz NULL | Null = nessuna scadenza |
| created_at | timestamptz | now() |

### `poll_options`
| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| poll_id | uuid NOT NULL | FK → polls(id) CASCADE |
| label | text NOT NULL | |
| order_idx | integer NOT NULL | Ordine di visualizzazione |

### `poll_votes`
| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| poll_id | uuid NOT NULL | FK → polls(id) CASCADE |
| option_id | uuid NOT NULL | FK → poll_options(id) CASCADE |
| user_id | uuid NOT NULL | |
| created_at | timestamptz | now() |
| UNIQUE | (poll_id, user_id) | Un voto per utente |

### RLS
- **polls/poll_options**: SELECT per authenticated; INSERT solo autore del post (join polls→posts)
- **poll_votes**: SELECT per authenticated; INSERT/UPDATE/DELETE per auth.uid() = user_id

### Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
```

---

## 2. Backend — `publish-post` edge function

Aggiungere campo opzionale `pollData` al body type:
```typescript
pollData?: {
  options: string[];  // 2-8 labels
  durationPreset: '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | null;
}
```

Dopo l'inserimento del post, se pollData presente:
1. Calcolare `expires_at` dal preset (o null)
2. INSERT in `polls`
3. INSERT bulk in `poll_options` con order_idx sequenziale

---

## 3. Composer — Creazione sondaggio

### `MediaActionBar.tsx`
- Nuova icona `ListChecks` (lucide) accanto all'icona infografica
- Props: `onCreatePoll`, `hasPoll`
- Se `hasPoll=true`, icona evidenziata/attiva

### Nuovo: `src/components/composer/PollCreator.tsx`
- UI inline sotto l'editor, sopra MediaPreviewTray
- 2 opzioni iniziali + bottone "Aggiungi opzione" (max 8)
- Input per ogni opzione con X per rimuovere (min 2)
- Selector durata: chips per 1h, 6h, 12h, 24h, 3gg, 7gg
- Bottone X in alto per rimuovere tutto il sondaggio

### `ComposerModal.tsx` + `DesktopComposer.tsx`
- Stato `pollData` nel composer
- Passato nel body di `publish-post`
- Non disponibile in modalità challenge

---

## 4. Feed — Visualizzazione e voto

### Nuovo: `src/components/feed/PollWidget.tsx`
Widget riutilizzabile con 3 stati:

**Non votato**: bottoni pill per ogni opzione + timer scadenza
**Votato**: barre percentuali animate, opzione scelta evidenziata, possibilità di cambiare voto (tap su altra opzione)
**Scaduto**: solo risultati, nessuna interazione

### Nuovo: `src/hooks/usePollVote.ts`
- Fetch poll + options + conteggi aggregati + voto utente corrente
- `vote(optionId)` → upsert in poll_votes
- `changeVote(newOptionId)` → update option_id
- Subscribe realtime su poll_votes per aggiornamento live conteggi

### Integrazione nel feed
- **ImmersivePostCard.tsx**: renderizzare `PollWidget` dopo il contenuto testuale, prima delle azioni
- **DesktopPostCard.tsx**: idem
- **QuotedPostCard.tsx**: mostrare sondaggio in modalità risultati read-only (per votare → navigare al post originale)

### Gate pre-voto
Quando l'utente tappa un'opzione del sondaggio:
1. Controllare se il gate è applicabile (stesse regole esistenti: con fonte → gate sempre; senza fonte → gate se >30 parole)
2. Verificare se l'utente ha già superato il gate per quel post (`post_gate_attempts`)
3. Se non superato → aprire QuizModal
4. Dopo superamento → registrare il voto
5. Se gate non applicabile → registrare il voto direttamente

---

## 5. File coinvolti (riepilogo)

| Area | File |
|---|---|
| Migration | nuova in `supabase/migrations/` |
| Edge Function | `supabase/functions/publish-post/index.ts` |
| Nuovo componente | `src/components/composer/PollCreator.tsx` |
| Nuovo componente | `src/components/feed/PollWidget.tsx` |
| Nuovo hook | `src/hooks/usePollVote.ts` |
| Modifica | `src/components/composer/MediaActionBar.tsx` |
| Modifica | `src/components/composer/ComposerModal.tsx` |
| Modifica | `src/components/composer/DesktopComposer.tsx` |
| Modifica | `src/components/feed/ImmersivePostCard.tsx` |
| Modifica | `src/components/feed/DesktopPostCard.tsx` |
| Modifica | `src/components/feed/QuotedPostCard.tsx` |

