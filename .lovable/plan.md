# Piano — Risolvere posting di Vinile

## Obiettivo
Far ripartire la pubblicazione di Vinile sostituendo la sorgente di ingestion (oggi search-based, che porta dentro "fake tracks" senza testi) con la playlist editoriale "Morning Routine" fornita dall'utente, poi verificare end-to-end forzando un post.

## 1. Modifica `supabase/functions/profile-ingest/index.ts` (solo blocco Vinile)
- Sostituire la logica di search Spotify (es. `tag:new genre:italian`) con un fetch della playlist:
  - Endpoint: `GET https://api.spotify.com/v1/playlists/37i9dQZF1DX7P3Ec4TfanK/tracks?market=IT&limit=100`
  - Auth: client credentials Spotify già configurati (SPOTIFY_CLIENT_ID/SECRET).
- Filtri di sanità sui track item:
  - skip se `track.is_local === true`
  - skip se manca `track.id`, `track.name`, `track.artists[0]` o `track.external_urls.spotify`
  - skip se `track.duration_ms < 60_000` (jingle/intro)
- Mantenere invariato lo schema di scrittura su `profile_source_feed` (stessi campi: `profile_id`, `external_id`, `title`, `author`, `url`, `article_published_at`, `metadata`, ecc.) così che `profile-compose-post` e `fetch-lyrics` continuino a funzionare senza modifiche.
- Usare `added_at` della playlist come `article_published_at` quando disponibile (fallback: `track.album.release_date`).
- Upsert idempotente su `(profile_id, external_id)` come già fatto.

## 2. Cleanup una tantum del pool esistente (SQL migration)
- Marcare `is_relevant = false` sui record `profile_source_feed` di Vinile che hanno pattern "junk" nel titolo:
  - regex case-insensitive su titoli/artisti contenenti: `mix`, `top hits`, `generazione`, `racing`, `playlist`, `2025`, `2026` quando combinato con keyword da playlist
  - condizione restrittiva al solo `profile_id` di Vinile per non toccare altri profili
- Questo libera lo slot dei 15 candidati in `profile-compose-post` e permette ai brani della Morning Routine di emergere subito.

## 3. Test end-to-end
- Deploy della funzione `profile-ingest`.
- Invocare manualmente `profile-ingest` (curl edge function) per popolare il pool con la nuova playlist.
- Verificare via `read_query` che ci siano nuovi record validi in `profile_source_feed` per Vinile.
- Invocare `profile-compose-post` per forzare la pubblicazione di Vinile fuori dallo slot schedulato.
- Verificare nel DB la presenza del nuovo `posts.row` di Vinile e nei log delle edge functions che `fetch-lyrics` abbia trovato testo.

## 4. Cosa NON tocco
- Nessuna modifica a `profile-compose-post`, `fetch-lyrics`, `generate-qa`, schema posts, UI feed.
- Nessuna modifica all'ingestion degli altri profili AI (@tommi, @mia, @leo, @greta, @nico, @sami, @vale, @mic).
- Nessuna modifica al sistema PULSE / Trust Score.

## Rollback
- L'ingest precedente è recuperabile da git history del file `profile-ingest/index.ts`.
- Il cleanup è reversibile (UPDATE `is_relevant = true` sugli stessi record).
