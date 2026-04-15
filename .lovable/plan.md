

# Batch Fix Profili AI — Piano di Implementazione

## File coinvolto
Solo `supabase/functions/profile-compose-post/index.ts` per i fix 1A-1C e 1E. Fix 1D richiede modifiche a `src/components/feed/CommentsDrawer.tsx` e `src/components/feed/CommentsSheet.tsx`. Fix 1F richiede query SQL su `ai_posting_schedule`.

---

## Fix 1A — Eliminare rassegna minima, retry su candidati multipli

Nel branch Mic (linee 290-443), attualmente se la trascrizione fallisce il post viene pubblicato in modalità "rassegna minima". Cambio: iterare su tutti i candidati (fino a 5) invece di usare solo il primo. Se nessun candidato ha trascrizione disponibile, non pubblicare e loggare un warning.

- Cambiare `limit(5)` → `limit(7)` (uno per fonte)
- Wrappare il blocco YouTube search + transcribe in un `for` loop sui candidati
- Se trascrizione OK → procedere con quel candidato e uscire dal loop
- Se trascrizione fallisce → loggare e passare al candidato successivo
- Se nessuno ha trascrizione → `continue` (skip slot, nessun post)
- Rimuovere completamente la variabile `isRassegnaMinima`, il branch `else` del prompt "MODALITÀ RASSEGNA MINIMA", e la modalità `rassegna_minima`

## Fix 1B — Validazione similarità titolo YouTube

In `searchYouTubeForPodcastEpisode` (linee 108-151):

- `maxResults=3` → `maxResults=5`
- Dopo aver ricevuto i risultati, iterare su tutti e calcolare similarità: parole in comune tra `episodeTitle` e `snippet.title` diviso totale parole uniche, case-insensitive
- Accettare solo risultati con similarità >= 0.40
- Loggare per ogni risultato: titolo cercato, titolo trovato, score
- Se nessuno supera la soglia, restituire `null`

## Fix 1C — Rotazione fonti podcast (cooldown settimanale)

Prima di selezionare il candidato Mic, query per contare quanti post Mic ha pubblicato per ogni `source_name` negli ultimi 7 giorni (JOIN `posts` + `profile_source_feed` su `used_in_post_id`). Filtrare i candidati escludendo fonti con >= 3 post nella settimana. Se dopo il filtro non resta nessun candidato, skip.

## Fix 1D — Gate commenti: chiarimento e allineamento

**Stato attuale**: il gate commenti si attiva solo se il post ha `shared_url` o media con OCR. Genera il quiz dalla fonte esterna (articolo linkato, trascrizione podcast, ecc.), non dal contenuto del post. Per i post Mic, questo significa che il gate genererà il quiz dalla fonte Spotify — che è corretto perché il contenuto originale è il podcast.

**Chiarimento necessario**: il tuo messaggio dice "se il post ha >120 parole, il Gate si genera sul contenuto del post". Questo cambierebbe radicalmente la logica attuale dove il gate verifica la comprensione della *fonte*, non del post AI. Per i post editoriali AI (Tommi, Mia, etc.) senza `shared_url` (modalità riflessione), il gate attualmente non si attiva affatto. Vuoi che si attivi anche per post senza fonte, usando il body del post come contenuto del quiz?

**Propongo di NON modificare il Fix 1D** in questo batch e discuterlo separatamente, perché il cambio ha implicazioni sulla filosofia del Comprehension Gate (verificare la fonte vs verificare il post dell'AI).

## Fix 1E — Validazione output min 50 parole

Dopo il parsing JSON di Gemini, sia nel branch Mic (linea ~388) che nel branch standard (linea ~565):

- Contare le parole del body con `body.split(/\s+/).length`
- Se < 50 parole, lanciare un errore con dettagli (profilo, fonte, output raw troncato)
- Il post non viene pubblicato, l'errore viene catturato dal `catch` esistente e loggato in `stats.errors`

## Fix 1F — Ridurre da 3 a 2 post/settimana per i 7 profili base

Ogni profilo base ha 3 slot attivi. Disattivare 1 slot per profilo (il meno strategico per orario). Approccio: per ogni profilo, `UPDATE ai_posting_schedule SET is_active = false WHERE id = <id_dello_slot_da_rimuovere>`.

Slot da disattivare (scelta: quello centrale della settimana per distribuire meglio i restanti 2):
- greta: martedì 07:30 → disattiva, resta domenica 18:00 + giovedì 12:00
- leo: mercoledì 13:45 → disattiva, resta lunedì 08:00 + venerdì 19:00
- mia: giovedì 15:30 → disattiva, resta martedì 10:00 + sabato 11:00
- nico: mercoledì 20:00 → disattiva, resta domenica 11:30 + venerdì 09:30
- sami: giovedì 08:45 → disattiva, resta lunedì 12:30 + sabato 17:00
- tommi: giovedì 09:15 → disattiva, resta lunedì 18:30 + venerdì 14:00
- vale: mercoledì 19:30 → disattiva, resta domenica 14:30 + sabato 09:00

Mic invariata (7 slot).

Risultato: 14 slot base + 7 Mic = 21 attivi totali.

---

## Riepilogo modifiche per file

| File | Fix |
|---|---|
| `supabase/functions/profile-compose-post/index.ts` | 1A, 1B, 1C, 1E |
| `ai_posting_schedule` (SQL) | 1F |
| Nessuna modifica | 1D (da discutere) |

## Domanda aperta

Fix 1D: confermi di voler cambiare la logica del gate commenti per generare quiz dal body del post (invece che dalla fonte) quando il body ha >120 parole? Oppure preferisci mantenere la logica attuale (quiz dalla fonte esterna) e discuterne separatamente?

