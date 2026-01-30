
# Fix Euristica OCR - Riconoscimento Screenshot Migliorato

## Problema Identificato
L'euristica `shouldPerformOCR()` in `useMediaUpload.ts` e troppo restrittiva. Il tuo screenshot (3024x4032, JPEG) ha ottenuto score 1/3 invece del minimo 2/3 richiesto.

**Motivi del fallimento:**
1. Aspect ratio 0.75 (3:4) - OK, rientra nel range 0.7-0.8
2. Larghezza 3024px - NON riconosciuta (manca dalla lista delle typical widths)
3. File JPEG - L'euristica premia solo PNG

## Soluzione Proposta

### Modifiche a `src/hooks/useMediaUpload.ts`

**1. Aggiungere larghezze tipiche mancanti (dispositivi moderni):**
```typescript
// PRIMA:
const typicalWidths = [1080, 1170, 1284, 1290, 1179, 1242, 1440, 1920, 2560];

// DOPO (aggiungere 3024, 2048, 2436, 2732):
const typicalWidths = [1080, 1170, 1284, 1290, 1179, 1242, 1440, 1920, 2048, 2436, 2560, 2732, 3024];
```

**2. Rimuovere discriminazione JPEG/PNG:**
Gli screenshot moderni (specialmente iOS) possono essere JPEG. Mantenere solo il check sulla dimensione file:
```typescript
// PRIMA:
const isLikelyPNG = file.type === 'image/png' && file.size > 200_000;

// DOPO:
const isLargeImage = file.size > 200_000; // Screenshot sono tipicamente > 200KB
```

**3. Ridurre soglia score a 1 (piu permissivo):**
```typescript
// PRIMA:
const score = [hasScreenshotRatio, hasTypicalWidth, isLikelyPNG].filter(Boolean).length;
return score >= 2;

// DOPO:
const score = [hasScreenshotRatio, hasTypicalWidth, isLargeImage].filter(Boolean).length;
return score >= 1; // Basta 1 indicatore per tentare OCR
```

## Rationale
- Con score >= 1, se l'immagine ha anche solo un aspect ratio da screenshot O una larghezza tipica O e grande, si tenta l'OCR
- Il costo di un falso positivo (OCR su foto normale) e basso: semplicemente il testo estratto sara < 120 chars e si fara fallback su Intent
- Il costo di un falso negativo (OCR mancato su screenshot con testo) e alto: l'utente non puo usare la feature

## Vincoli Rispettati
- Nessuna modifica alla Edge Function (gia fixata)
- Nessuna modifica al Gate
- Nessuna modifica al sistema PULSE/Trust Score
- Fix isolato in un singolo file

## Test Post-Modifica
1. Caricare lo stesso screenshot JPEG 3024x4032
2. Verificare nel console log: `shouldOCR: true`
3. Verificare che `extracted_status` passi a `pending` poi `done`
4. Verificare che il Gate proponga quiz basato sul testo estratto
