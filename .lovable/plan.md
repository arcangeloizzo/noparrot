

# Piano: Upgrade Trascrizione Video con Deepgram

## Problema Attuale

OpenAI Whisper ha un limite hardcoded di **25MB** per file. Video moderni (specialmente in .mov da iPhone) superano facilmente questa soglia. Il video dell'utente era di ~55MB e la trascrizione ha fallito con errore 413.

---

## Soluzione: Integrare Deepgram

**Deepgram** offre:
- Limite file fino a **2GB**
- Supporto per **URL diretto** (no download in memoria)
- Trascrizione real-time o batch
- Tier gratuito: $200 di crediti per iniziare

### Architettura Proposta

```text
Client                    Edge Function                  Deepgram
   │                           │                            │
   │──POST /extract-media-text─▶│                            │
   │  {mediaId, mediaUrl}      │                            │
   │                           │──POST /v1/listen───────────▶│
   │                           │  {url: mediaUrl}           │
   │                           │                            │
   │                           │◀──────────transcript────────│
   │                           │                            │
   │                           │──UPDATE media.extracted_text│
   │◀───────{success}──────────│                            │
```

---

## Modifiche Tecniche

### File 1: `supabase/functions/extract-media-text/index.ts`

**A. Aggiungere supporto Deepgram (provider primario)**

```typescript
// Nuove costanti
const DEEPGRAM_MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const WHISPER_MAX_SIZE = 25 * 1024 * 1024; // 25MB (fallback)

// Nuova funzione per trascrizione Deepgram
async function transcribeWithDeepgram(
  mediaUrl: string, 
  apiKey: string
): Promise<{ transcript: string; language: string; confidence: number }> {
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=it&detect_language=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: mediaUrl }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  const language = data.results?.channels?.[0]?.detected_language || 'it';
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
  
  return { transcript, language, confidence };
}
```

**B. Modificare la sezione trascrizione (linee 110-227)**

```typescript
if (extractionType === 'transcript') {
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Check durata video (manteniamo il limite di 3 minuti per UX)
  if (durationSec && durationSec > MAX_VIDEO_DURATION_SEC) {
    // ... logica esistente per video troppo lunghi
  }
  
  // STRATEGIA: Deepgram primario, Whisper fallback per file piccoli
  let transcript = '';
  let detectedLanguage = 'unknown';
  let provider = '';
  
  if (deepgramApiKey) {
    // DEEPGRAM: Supporta file fino a 2GB via URL diretto
    console.log('[extract-media-text] Using Deepgram (URL-based, max 2GB)');
    try {
      const result = await transcribeWithDeepgram(mediaUrl, deepgramApiKey);
      transcript = result.transcript;
      detectedLanguage = result.language;
      provider = 'deepgram-nova-2';
      console.log(`[extract-media-text] Deepgram success: ${transcript.length} chars, lang: ${detectedLanguage}`);
    } catch (err) {
      console.error('[extract-media-text] Deepgram failed:', err);
      // Fallback a Whisper se disponibile e file piccolo
    }
  }
  
  // FALLBACK: Whisper per file < 25MB se Deepgram fallisce
  if (!transcript && openaiApiKey) {
    console.log('[extract-media-text] Falling back to Whisper (download required, max 25MB)');
    // ... logica Whisper esistente (linee 143-201)
    // Aggiungere check dimensione prima del download
  }
  
  // ... resto della logica esistente per salvare il risultato
}
```

**C. Migliorare la gestione degli errori**

```typescript
// Errori specifici per feedback utente
const ERROR_MESSAGES = {
  'file_too_large': 'Video troppo pesante per la trascrizione',
  'video_too_long': 'Video troppo lungo (max 3 minuti)',
  'service_unavailable': 'Servizio di trascrizione non disponibile',
  'unsupported_format': 'Formato video non supportato',
  'network_error': 'Errore di rete durante la trascrizione',
};
```

---

### File 2: Configurazione Secret

**Nuovo secret richiesto:**

```
DEEPGRAM_API_KEY = "dg_xxxxxxxxxxxxxxxx"
```

L'utente dovra' creare un account Deepgram e ottenere una API key:
1. Registrarsi su https://console.deepgram.com
2. Creare un progetto
3. Generare API key
4. Aggiungere come secret in Lovable

---

### File 3: `src/components/composer/ComposerModal.tsx`

**Migliorare feedback errori (opzionale ma consigliato)**

```typescript
const handleRequestTranscription = async (mediaId: string) => {
  try {
    const success = await requestTranscription(mediaId);
    if (success) {
      toast.info('Trascrizione in corso...');
    }
  } catch (error: any) {
    const errorCode = error?.message || '';
    
    if (errorCode.includes('413') || errorCode.includes('file_too_large')) {
      toast.error('Video troppo pesante. Prova con un file piu\' piccolo.');
    } else if (errorCode.includes('video_too_long')) {
      toast.error('Video troppo lungo. Massimo 3 minuti.');
    } else if (errorCode.includes('format') || errorCode.includes('codec')) {
      toast.error('Formato video non supportato.');
    } else {
      toast.error('Errore durante la trascrizione');
    }
  }
};
```

---

## Flusso Aggiornato

```text
1. Utente carica video (qualsiasi dimensione fino a 100MB del bucket)
2. Clicca "Trascrivi"
3. Edge function riceve richiesta
4. IF Deepgram API key configurata:
     - Invia URL diretto a Deepgram (no download)
     - Deepgram elabora e ritorna trascrizione
   ELSE IF Whisper API key E file < 25MB:
     - Scarica video in memoria
     - Invia a Whisper
   ELSE:
     - Ritorna errore "Servizio non disponibile"
5. Salva trascrizione in media.extracted_text
6. generate-qa legge da media.extracted_text (invariato)
```

---

## Vantaggi di Deepgram

| Aspetto | Whisper | Deepgram |
|---------|---------|----------|
| Limite file | 25MB | 2GB |
| Download richiesto | Si (in memoria) | No (URL diretto) |
| Velocita | ~1x real-time | Real-time streaming |
| Lingue | 50+ | 30+ (ottimo italiano) |
| Costo | ~$0.006/min | ~$0.0043/min |
| Timeout risk | Alto per file grandi | Basso |

---

## File da Modificare

| File | Modifica |
|------|----------|
| `supabase/functions/extract-media-text/index.ts` | Aggiungere Deepgram come provider primario |
| Supabase Secrets | Aggiungere `DEEPGRAM_API_KEY` |
| `src/components/composer/ComposerModal.tsx` | Migliorare messaggi errore (opzionale) |

---

## Configurazione Edge Function Timeout

Se necessario, il timeout della Edge Function puo' essere esteso nel config.toml:

```toml
[functions.extract-media-text]
verify_jwt = false
# Il timeout default e' 60s, sufficiente per Deepgram che usa URL diretto
```

---

## Piano di Rollout

1. **Fase 1**: Aggiungere secret `DEEPGRAM_API_KEY`
2. **Fase 2**: Modificare `extract-media-text` con logica Deepgram + fallback Whisper
3. **Fase 3**: Testare con video > 25MB
4. **Fase 4**: Migliorare feedback errori nel Composer (opzionale)

---

## Note

- Il flusso `generate-qa` rimane **invariato** - legge sempre da `media.extracted_text`
- Il limite di **3 minuti per video** rimane per UX (quiz troppo lunghi non sono utili)
- Whisper resta come **fallback** per compatibilita' retroattiva
- Il bucket `user-media` ha gia' limite **100MB**, compatibile con Deepgram

