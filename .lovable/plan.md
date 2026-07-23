## Obiettivo
Aggiornare tutti i riferimenti canonici dell'app dal dominio `noparrot.lovable.app` al dominio custom appena connesso `noparrot.app`, senza toccare logica di feed, gate, reader, messaggi.

## Modifiche previste

### 1. Runtime secret `PUBLIC_APP_URL`
- Aggiungere il secret `PUBLIC_APP_URL=https://noparrot.app` tramite `secrets--set_secret`.
- La edge function `share` lo legge già (`Deno.env.get('PUBLIC_APP_URL')`), quindi dopo questo passo i redirect e i meta canonical punteranno automaticamente al nuovo dominio.

### 2. `index.html`
- Aggiungere `<link rel="canonical" href="https://noparrot.app/" />`.
- Aggiornare `og:url` a `https://noparrot.app/`.
- Sostituire `og:image` e `twitter:image` da `https://noparrot.lovable.app/apple-touch-icon.png` a `https://noparrot.app/og-default.png` (1200×630, brand card già presente in `public/`).

### 3. `supabase/functions/share/index.ts`
- Cambiare il fallback `DEFAULT_APP_URL` da `https://noparrot.lovable.app` a `https://noparrot.app`.
- Correggere i riferimenti interni che usano ancora `DEFAULT_APP_URL` per canonical e immagini: farli usare `APP_URL` così rispettano il secret se presente.
  - `canonicalUrl` per tutti i tipi (`post`, `profile`, `challenge`, `il_punto`).
  - `defaultImage` e `ilPuntoImage`.

### 4. Verifica
- `bunx tsgo --noEmit` per confermare che il typecheck resta verde.
- Deploy della edge function `share`.
- Curl diagnostico rapido per confermare che la risposta della funzione abbia:
  - `Content-Type: text/html; charset=utf-8`
  - `x-share-version` presente
  - redirect/canonical che puntano a `https://noparrot.app`

## Non in scope
- Feed card, reader, gate, overscroll, composer, messaggi, profilo, nebulosa: nessuna modifica.
- Service worker e manifest: usano path relativi rispetto a `self.location.origin`, quindi si adattano automaticamente al nuovo dominio.
- `src/integrations/supabase/client.ts` e `.env`: non vengono toccati (auto-generati).

## Risultato atteso
I link condivisi, i meta OpenGraph e il canonical dell'app rifletteranno `https://noparrot.app` invece di `noparrot.lovable.app`.