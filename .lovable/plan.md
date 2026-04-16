

## Diagnosi

Ho controllato il post di Vinile nel DB (id `60d714a4...`, "Quando l'amore non è una hit estiva"): il `content` esiste eccome, **633 caratteri** ben formati. Anche il post precedente ("La gabbia che ci forma e ci consuma") ha 791 caratteri di body. Il problema è puramente di **rendering frontend**.

### Causa root

In `src/components/feed/ImmersivePostCard.tsx`, il branch `isSpotifyTrack` (righe **2361–2403**) usato per i brani Spotify (Vinile) renderizza solo:
- artwork dell'album
- titolo Spotify (nome canzone)
- nome artista
- pill "Spotify"

**Non viene mai stampato `post.title` (titolo editoriale di Vinile, "QUANDO L'AMORE NON È UNA HIT ESTIVA") né `post.content` (body)**. Infatti nello screenshot vediamo il titolo editoriale (renderizzato dal layer "header" del card, fuori dal branch shared_url) ma sotto l'artwork compare solo "Canzone Estiva" + badge Spotify, e zero body.

Confronto col branch `isSpotifyEpisode` (righe 2308–2360, usato per @mic): quello sì renderizza correttamente `post.title` + `post.content` (con truncation a 400 char + "Mostra tutto") + una `SpotifyPodcastCompactCard` compatta in basso. È il layout "Vetrina" già memorizzato per i podcast.

## Fix proposto

Allineare il branch **`isSpotifyTrack`** al layout Vetrina del branch `isSpotifyEpisode`, così Vinile mostra:

1. **Titolo editoriale** (`post.title`) in alto in stile Impact (già presente nel layout episode)
2. **Body** (`post.content`) con truncation a 400 char + "Mostra tutto" via `MentionText`
3. **Card compatta Spotify** in basso (artwork + nome canzone + artista + pill verde) → riusare `SpotifyPodcastCompactCard` oppure creare/usare un componente equivalente per i brani musicali (l'attuale è già visivamente adatto: immagine quadrata + titolo + sottotitolo + pill).

In pratica il branch `isSpotifyTrack` diventa quasi identico a `isSpotifyEpisode`, con la sola differenza semantica del componente compatto in basso (track vs episode — ma a livello visuale `SpotifyPodcastCompactCard` funziona benissimo anche per le canzoni: mostra immagine + nome + sottotitolo + click su Spotify).

### File da modificare

- `src/components/feed/ImmersivePostCard.tsx` → sostituire il blocco righe **2361–2403** con un layout Vetrina analogo a quello degli episodi (titolo + body + card compatta in basso).

### Note

- Nessuna modifica al DB, edge function, o system prompt: il body c'è e viene generato correttamente.
- Nessuna modifica al ramo `isSpotifyEpisode` (Mic) né ad altri rami.
- Il fix è puramente di presentazione e si limita a un singolo file.

