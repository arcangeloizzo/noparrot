

# Fix: Notifiche Challenge — Due Bug

## Problema 1: Notifica "challenge_response" mai inserita

La tabella `notifications` ha un CHECK constraint sul campo `type` che accetta solo: `like`, `comment`, `follow`, `mention`, `message_like`, `reshare`, `new_user`. Il tipo `challenge_response` non è incluso, quindi l'INSERT nella edge function `submit-challenge-response` (step 9, riga 252) fallisce silenziosamente (wrapped in try/catch).

**Fix:** Migration per aggiornare il CHECK constraint aggiungendo `'challenge_response'` alla lista dei tipi ammessi.

## Problema 2: Post challenge vuoto quando si clicca la notifica "like"

La pagina `/post/:id` (Post.tsx) non fa il join con `challenges`, `voice_posts` o `post_type`. La query (riga 24-53) carica solo `author`, `questions`, `reactions`, `comments`, `post_media`. Per un post di tipo challenge, il campo `content` è vuoto e non ci sono dati sulla thesis/audio — risultato: pagina vuota (come nello screenshot).

Il feed (`usePosts.ts`) invece fa il join corretto con `challenges!challenges_post_id_fkey` e `voice_posts`.

**Fix:** Allineare la query in `Post.tsx` a quella di `usePosts.ts`, aggiungendo:
- `post_type`
- `voice_posts (id, audio_url, duration_seconds, waveform_data, transcript, transcript_status)`
- `challenges!challenges_post_id_fkey (id, thesis, duration_hours, status, expires_at, votes_for, votes_against, voice_post_id, voice_posts!challenges_voice_post_id_fkey (...))`

E mappare i dati nella trasformazione del risultato (righe 57-103), aggiungendo `post_type`, `voice_post`, e `challenge` all'oggetto restituito, seguendo lo stesso pattern di `usePosts.ts`.

## Riepilogo modifiche

1. **Database migration** — ALTER CHECK constraint su `notifications.type` per includere `'challenge_response'`
2. **`src/pages/Post.tsx`** — Estendere la query Supabase e la mappatura dati per supportare challenge e voice posts

