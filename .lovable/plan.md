## Contesto verificato prima di partire

- **Share edge function esiste già** (`supabase/functions/share`): accetta `?id=…&type=post|challenge|il_punto|profile`, genera OG in bucket `share-previews` e ridireziona. Copre già i punti 1a e 2a lato meta. Non serve creare `og-post`/`og-profile` da zero: **estendo `share`** aggiungendo fallback statico brandizzato quando manca l'immagine e rispettando `is_removed`.
- **Bottone share nella action bar** già invoca `navigator.share` con l'URL della edge function (ImmersivePostCard L3528). Basta **saltare lo `ShareSheet` custom** quando l'intento è "esterno": mando direttamente il native sheet + fallback clipboard.
- **RLS attuale**:
  - `posts`: SELECT solo `authenticated`.
  - `profiles`: SELECT solo su proprio profilo.
  - `public_profiles` (view) esiste già per esporre campi ridotti.
  - Non c'è campo `visibility` sui post → **ogni post non-`is_removed` è di fatto pubblico** all'interno dell'app. Coerente estenderlo agli ospiti.
  - Non c'è impostazione di privacy profilo modificabile via `SettingsPrivacy` (verifico velocemente e riporto).
- **Timestamp per timeframe (punto 3)**: la view materializzata `user_cognitive_density` **non ha `created_at`**. Ma tutte le sorgenti sì (`posts.created_at`, `post_gate_attempts.created_at`, `comments.created_at`, `challenge_responses.created_at`). Procedo con **RPC dedicata `get_user_cognitive_density_timeframe(p_user_id, p_since, p_until)`** che riesegue lo stesso calcolo pesato della view ma filtrato per timestamp. Costo accettabile per una vista aperta on-demand.

## Forma dell'URL condiviso (1a)

Mantengo la forma esistente: `https://<supabase>/functions/v1/share?id=<uuid>&type=post|challenge|profile`. Vantaggi: già in produzione, cacheabile, un solo posto per meta + redirect. Non introduco slug leggibili (richiedono nuova tabella di redirect stabile) per non ampliare scope beta.

## Interventi

### 1 · Condivisione esterna post

1. **Migrazione RLS**: aggiungo policy `SELECT` a `anon` su `posts` con `is_removed = false`, e su `public_profiles` (già view; verifico GRANT). Aggiungo `SELECT anon` alle tabelle referenziate dalla pagina Post in sola lettura: `voice_posts`, `challenges`, `questions`, `post_media`, `media`, `reactions` (aggregata), `comments` (count), tutte filtrate a post non rimossi via join. Se troppo invasivo → creo `get_public_post(p_id)` RPC `SECURITY DEFINER` che ritorna JSON con i soli campi necessari e uso quella. **Scelgo la RPC**: più chirurgica, zero rischio di leak collaterali.
2. **`Post.tsx`**: quando `user` è nullo, chiamo la RPC `get_public_post`. Quando c'è user, resta il flusso attuale. Azioni (reagire, commentare, gate) mostrano CTA "Entra su NoParrot" invece di eseguire.
3. **Edge function `share`**: aggiungo fallback `public/og-default.png` (1200×630, sfondo #0E1522 + logo). Se post `is_removed=true` → meta generici. Cache header già presente (`s-maxage=600`), lascio.
4. **Bottone share nella action bar**: oggi apre `ShareSheet` con tre opzioni. Aggiungo un **quarto pulsante "Condividi fuori da NoParrot"** che invoca direttamente `navigator.share` con l'URL della edge function, fallback clipboard. Non rimuovo le altre due opzioni (feed / amico) — restano utili. Il punto 1c del brief chiede "niente sheet custom": interpreto come "il tap 'esterno' non deve aprire un secondo sheet nostro", cosa già rispettata.

### 2 · Condivisione profilo + nebulosa

1. **`generateNebulaShareImage`** in `src/lib/nebulaShareImage.ts`: canvas 1080×1920, sfondo #0E1522, radial gradient tenui, riuso della logica di posizionamento pianeti estratta in `src/lib/nebulaLayout.ts` (funzione pura condivisa con `CognitiveNebulaCanvas` e `CompactNebula`). Testo Anton/Mono via `ctx.font`. Ritorna `Blob` PNG.
2. **Pulsante "Condividi la tua nebulosa"** nell'header del Profilo (solo per il profilo proprio): mobile con `navigator.canShare({ files: [png] })` → share nativo con file; fallback → download PNG + copia link `/profile/:id` tramite edge function `share?type=profile`.
3. **`UserProfile.tsx` per ospiti**: nuova RPC `get_public_profile_summary(p_user_id)` con campi pubblici (username, full_name, avatar_url, bio) + densità cognitiva + counts. Rispetta eventuale flag privacy se esiste.
4. **Edge function `share` type=profile**: già presente, lascio il fallback statico `og-default.png` per ora (og:image dinamica della nebulosa a un round successivo, come indicato).

### 3 · Timeframe nebulosa

1. **RPC `get_user_cognitive_density_timeframe(p_user_id, p_since, p_until)`**: riscrivo il calcolo della materialized view come plpgsql/sql function con filtro `created_at BETWEEN`. Ritorna stessa forma della RPC esistente (`macro_category, density, action_breakdown`).
2. **`NebulaExpandedSheet.tsx`**: rail di 3 pill mono `TUTTO | 30 GIORNI | 7 GIORNI` sotto il sottotitolo. State locale `timeframe`. La query alimenta pianeti + dettaglio per area.
3. **Delta**: seconda query sullo stesso RPC per il periodo precedente di pari durata. Mostro `+N` teal / `—` se zero. Nessun colore negativo, solo numero.
4. **Stato vuoto**: se totale densità = 0 nel periodo → messaggio + pill per tornare a TUTTO.
5. **`CompactNebula` invariata**: continua a leggere la view materializzata (TUTTO).

## File toccati

**Nuovi**
- `src/lib/nebulaLayout.ts` — layout puro condiviso
- `src/lib/nebulaShareImage.ts` — canvas → PNG blob
- `public/og-default.png` — 1200×630 brand fallback (generato con imagegen)
- Migrazione SQL: RPC `get_public_post`, `get_public_profile_summary`, `get_user_cognitive_density_timeframe`

**Modificati**
- `supabase/functions/share/index.ts` — fallback statico + rispetto `is_removed`
- `src/pages/Post.tsx` — path guest via RPC
- `src/pages/UserProfile.tsx` — path guest via RPC + azione condividi nebulosa
- `src/pages/Profile.tsx` — bottone condividi nebulosa (proprio profilo)
- `src/components/share/ShareSheet.tsx` — quarto pulsante "Condividi fuori"
- `src/components/profile/NebulaExpandedSheet.tsx` — pill timeframe + delta + empty state
- `src/components/profile/CognitiveNebulaCanvas.tsx` — usa `nebulaLayout` condiviso, accetta prop `data` esterno per riuso
- `src/components/feed/ImmersivePostCard.tsx` — collega quarto pulsante allo share nativo esistente

## Rischi / conferme che chiedo

- **RLS scelta a RPC**: mi conferma che va bene esporre via `SECURITY DEFINER` invece di aprire SELECT anon diretto? È più sicuro ma richiede due funzioni.
- **Costo timeframe RPC**: ricalcola tutto ogni apertura. Su utenti con molti post può essere pesante (100–300ms stimati). Se preferisci, aggiungo indice `(author_id, created_at)` su `posts` per mitigare.
- **`SettingsPrivacy`**: verifico se c'è un flag `is_profile_public`. Se non esiste, tutti i profili con post sono di fatto pubblici; procedo con quella assunzione.

Alla fine consegno: elenco file + esiti RLS + conferma che timestamp esistevano sulle sorgenti.
