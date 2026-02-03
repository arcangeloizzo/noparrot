
# Piano: Fix Caricamento Video e Integrazione Whisper nel Composer

## Problema Identificato

Il caricamento video nel Composer **non funziona** perché:

1. **Bucket sbagliato**: `useMediaUpload.ts` usa il bucket `avatars` che:
   - Ha un limite di **5.24 MB** (troppo piccolo per video)
   - Accetta **solo immagini** (PNG/JPG/WebP) - nessun MIME type video permesso

2. **UI trascrizione poco visibile**: Il tasto "Genera trascrizione" esiste ma è un piccolo bottone sotto le miniature, poco evidente

3. **Nessun feedback visivo chiaro**: Manca uno spinner overlay sulla miniatura durante la trascrizione

---

## Soluzione Proposta

### 1. Database: Nuovo Bucket `user-media` dedicato

Creare un bucket ottimizzato per tutti i media utente (immagini + video):

```sql
-- Crea bucket per media utente con limite 100MB e tutti i MIME video/immagini
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media', 
  true,
  104857600,  -- 100 MB
  ARRAY[
    -- Immagini
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    -- Video
    'video/mp4', 'video/quicktime', 'video/mov', 'video/webm', 'video/mpeg', 'video/3gpp'
  ]
);

-- Policy RLS per upload
CREATE POLICY "Users can upload own media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy RLS per lettura pubblica
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'user-media');

-- Policy RLS per delete
CREATE POLICY "Users can delete own media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 2. `useMediaUpload.ts` - Usare il nuovo bucket

Modificare l'hook per:
- Usare il bucket `user-media` invece di `avatars`
- Mantenere la logica esistente per video (durata, trascrizione on-demand)

```typescript
// Linea 93: cambiare da 'avatars' a 'user-media'
const bucketName = 'user-media';
```

### 3. `MediaPreviewTray.tsx` - UI Trascrizione Migliorata

Rendere il tasto trascrizione più visibile e con feedback overlay:

**Modifiche UI:**
- Overlay semitrasparente sulla miniatura video con icona Mic/Sparkles
- Stato "Processing" con spinner centrato sulla thumbnail
- Badge verde "✓ Trascritto" al completamento
- Disabilitare il tasto se video > 3 minuti

```typescript
// Nuovo design: overlay sulla thumbnail invece di bottone separato
{item.type === 'video' && item.extracted_status === 'idle' && onRequestTranscription && (
  <button
    onClick={() => onRequestTranscription(item.id)}
    disabled={isTranscribing || (item.duration_sec && item.duration_sec > 180)}
    className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg"
  >
    <div className="flex flex-col items-center gap-1">
      <Sparkles className="w-5 h-5 text-white" />
      <span className="text-[10px] text-white font-medium">
        {item.duration_sec && item.duration_sec > 180 ? 'Max 3 min' : 'Trascrivi'}
      </span>
    </div>
  </button>
)}

{/* Spinner overlay durante trascrizione */}
{item.type === 'video' && item.extracted_status === 'pending' && (
  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
    <Loader2 className="w-6 h-6 animate-spin text-white" />
  </div>
)}
```

### 4. `MediaActionBar.tsx` - Confermare i limiti

Verificare che i limiti siano coerenti:
- Già configurato con 100MB per video (riga 35) ✓
- Accept include `video/*` ✓

### 5. Vincoli di Stabilità

| Vincolo | Implementazione |
|---------|----------------|
| **YouTube separato** | Nessuna modifica a `transcribe-youtube` - usa sottotitoli nativi |
| **Trascrizione on-demand** | L'utente clicca esplicitamente il tasto "Trascrivi" |
| **Modal non si chiude** | `hasPendingExtraction` blocca già il publish (riga 145 ComposerModal) |
| **Flusso generate-qa** | `qaSourceRef: { kind: 'mediaId', id: media.id }` già implementato (riga 450) |

---

## File da Modificare

| File | Modifica |
|------|----------|
| **Nuova migrazione SQL** | Crea bucket `user-media` con policy |
| `src/hooks/useMediaUpload.ts` | Cambia bucket da `avatars` a `user-media` |
| `src/components/media/MediaPreviewTray.tsx` | UI overlay trascrizione migliorata |

---

## Flusso Corretto Post-Fix

```text
1. Utente seleziona/registra video (fino a 100MB)
2. useMediaUpload → upload su bucket 'user-media'
3. MediaPreviewTray mostra thumbnail con overlay "Trascrivi"
4. Utente clicca overlay → requestTranscription(mediaId)
5. extract-media-text (Whisper) processa il video
6. Stato updated: extracted_status = 'done', extracted_text = "..."
7. ComposerModal rileva mediaWithExtractedText → attiva Gate
8. generateQA con qaSourceRef: { kind: 'mediaId' }
9. Quiz mostrato, utente risponde, post pubblicato
```

---

## Separazione Flussi Garantita

| Flusso | Sorgente | Servizio | Note |
|--------|----------|----------|------|
| **YouTube Link** | Sottotitoli YT | Supadata | Nessun Whisper |
| **Video Caricato** | Audio → Whisper | OpenAI | On-demand, max 3 min |
| **Immagine** | OCR | Gemini Vision | Automatico se screenshot |

