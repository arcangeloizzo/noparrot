
# Piano: Generazione Infografica AI (NanoBanana) + Fix Build Errors

## Fase 1: Fix Build Errors Pre-esistenti

### 1a. `send-push-notification/index.ts` - Import web-push
Il file usa `npm:web-push@3.6.7` che Deno non risolve. Cambiare in `https://esm.sh/web-push@3.6.7` (come gia fatto per `generate-vapid-keys`).

### 1b. `FeedCardAdapt.tsx` - Modulo mancante e errori multipli
Il file importa da `@/components/media/utils/mediaUtils` che non esiste (la cartella `utils/` non c'e). Inoltre ha ~18 errori di tipo.
- Creare il file `src/components/media/utils/mediaUtils.ts` con la funzione `detectPlatformFromUrl` esportata
- Risolvere gli errori TS rimanenti (property `url` su string, `title` in ReactNode, `setShowReactionsSheet` non definito, `postId` prop non valida)

### 1c. `ImmersivePostCard.tsx` - errori `title` in ReactNode
Stesso pattern di `FeedCardAdapt.tsx` - toast() chiamato con oggetto `{title: ...}` ma la firma attuale attende un ReactNode. Usare `toast.info(message)` o `toast.error(message)` di sonner.

### 1d. `usePushNotifications.ts` - `pushManager` non trovato
Aggiungere type assertion o dichiarazione d'ambiente per `ServiceWorkerRegistration.pushManager`.

### 1e. `Profile.tsx` - proprieta duplicate in object literal
Rimuovere la proprieta duplicata.

---

## Fase 2: Infografica AI (Feature Core)

### 2a. Edge Function: `supabase/functions/generate-infographic/index.ts`

**Sicurezza**: `verify_jwt = false` nel config.toml, ma validazione JWT nel codice con `getClaims()`. Lo `userId` viene estratto dal token, MAI dal body della richiesta.

```typescript
// Pseudocodice
const authHeader = req.headers.get('Authorization');
const token = authHeader.replace('Bearer ', '');
const { data, error } = await supabase.auth.getClaims(token);
if (error) return 401;
const userId = data.claims.sub;
```

**Modello**: `google/gemini-2.5-flash-image` (NanoBanana) - genera immagini da testo.

**Flusso**:
1. Riceve `{ text, theme }` dal client (NO userId nel body)
2. Valida JWT e estrae userId dal token
3. Costruisce il prompt con palette dinamica (light/dark)
4. Chiama Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
5. Estrae l'immagine base64 dalla risposta
6. Upload su storage bucket `user-media`
7. Inserisce record nella tabella `media`
8. Restituisce `{ mediaId, url }`

**System Prompt** (backend only):
```
Agisci come un Expert Visual Content Strategist e Information Designer.
Il tuo compito e tradurre l'analisi testuale fornita in un'infografica minimalista ad alto impatto.
Estetica: Premium Tech, pulita, moderna.
Linee Guida:
- Analisi Semantica: identifica 3 pilastri chiave nel testo.
- Layout: Verticale, con titolo d'impatto, 3 sezioni iconografiche e un grafico di sintesi finale.
- Palette: {Deep Blue/Slate su sfondo chiaro | Neon su sfondo scuro, alto contrasto}
- Tipografia: Sans-serif, numeri grandi e bold.
Dati di Input (Testo del Creator):
```

**Gestione Errori**:
- 429: `{ error: "Rate limit superato, riprova tra poco" }`
- 402: `{ error: "Crediti AI esauriti" }`
- Immagine non generata: `{ error: "Impossibile generare l'infografica" }`

### 2b. Config TOML
```toml
[functions.generate-infographic]
verify_jwt = false
```

### 2c. `useMediaUpload.ts` - Aggiungere `addExternalMedia`

Nuova funzione per inserire un media gia creato dall'edge function nell'array `uploadedMedia`:

```typescript
const addExternalMedia = (media: { id: string; type: 'image' | 'video'; url: string }) => {
  setUploadedMedia(prev => [...prev, {
    ...media,
    order_idx: prev.length,
    extracted_status: 'idle' as const,
    extracted_kind: null
  }]);
};
```

Esportata nel return dell'hook.

### 2d. `MediaActionBar.tsx` - Pulsante BarChart3

Nuove props:
- `onGenerateInfographic?: () => void`
- `infographicEnabled?: boolean`
- `isGeneratingInfographic?: boolean`

Aggiungere icona `BarChart3` nel gruppo destro (prima di Camera):
- Disabilitato (opacity-40) quando `infographicEnabled === false`
- Mostra `Loader2` animato durante la generazione
- Tooltip: "Genera infografica"

### 2e. `ComposerModal.tsx` - Integrazione

**Nuovo state**:
```typescript
const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
```

**Nuova funzione** `handleGenerateInfographic`:
```typescript
const handleGenerateInfographic = async () => {
  if (isGeneratingInfographic || wordCount < 50) return;

  try {
    setIsGeneratingInfographic(true);
    setShowAnalysisOverlay(true);
    // Overlay message: "Sintetizzando i concetti chiave in un'infografica..."

    const isDark = document.documentElement.classList.contains('dark');

    const { data, error } = await supabase.functions.invoke('generate-infographic', {
      body: { text: content, theme: isDark ? 'dark' : 'light' }
    });

    if (error) throw new Error('Errore di rete');
    if (data?.error) {
      // Handle 429/402 specifically
      if (data.status === 429) toast.error('Troppi tentativi, riprova tra poco');
      else if (data.status === 402) toast.error('Crediti AI esauriti');
      else toast.error(data.error);
      return;
    }

    // Add to media array
    addExternalMedia({ id: data.mediaId, type: 'image', url: data.url });
    toast.success('Infografica generata!');
  } catch (err) {
    console.error('[Composer] Infographic error:', err);
    toast.error("Impossibile generare l'infografica. Riprova.");
  } finally {
    setIsGeneratingInfographic(false);
    setShowAnalysisOverlay(false);
  }
};
```

**AnalysisOverlay**: Aggiornare il messaggio condizionalmente:
```tsx
<AnalysisOverlay 
  isVisible={showAnalysisOverlay} 
  message={isGeneratingInfographic 
    ? "Sintetizzando i concetti chiave in un'infografica..." 
    : "Analisi in corso..."
  } 
/>
```

**MediaActionBar props**: Passare le nuove props:
```tsx
<MediaActionBar
  // ...existing props...
  onGenerateInfographic={handleGenerateInfographic}
  infographicEnabled={wordCount >= 50}
  isGeneratingInfographic={isGeneratingInfographic}
/>
```

**Rigenerazione**: Se l'utente cancella l'infografica dal `MediaPreviewTray` e preme di nuovo BarChart3, ne genera una nuova (nessuno stato speciale - il media cancellato viene rimosso normalmente).

---

## Riepilogo File

| File | Azione |
|------|--------|
| `supabase/functions/send-push-notification/index.ts` | Fix import web-push |
| `src/components/media/utils/mediaUtils.ts` | Nuovo - utility mancante |
| `src/components/feed/FeedCardAdapt.tsx` | Fix errori TS multipli |
| `src/components/feed/ImmersivePostCard.tsx` | Fix errori toast |
| `src/hooks/usePushNotifications.ts` | Fix tipo pushManager |
| `src/pages/Profile.tsx` | Fix proprieta duplicata |
| `supabase/functions/generate-infographic/index.ts` | Nuovo - edge function |
| `supabase/config.toml` | Aggiungere entry |
| `src/hooks/useMediaUpload.ts` | Aggiungere addExternalMedia |
| `src/components/composer/MediaActionBar.tsx` | Aggiungere pulsante BarChart3 |
| `src/components/composer/ComposerModal.tsx` | Aggiungere logica generazione |

## Ordine di Implementazione

1. Fix build errors pre-esistenti (Fase 1)
2. Edge function + config.toml
3. useMediaUpload (addExternalMedia)
4. MediaActionBar (pulsante BarChart3)
5. ComposerModal (logica + overlay)
