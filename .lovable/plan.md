
# Fix Soglie 120 Caratteri - extract-media-text

## Obiettivo
Allineare la soglia minima di caratteri per OCR e trascrizione a **120 caratteri** nella Edge Function `extract-media-text`, per coerenza con la logica del Gate.

## Modifica Richiesta

**File**: `supabase/functions/extract-media-text/index.ts`

### Cambio 1 - Linea 81 (OCR)
```typescript
// DA:
if (extractedText && extractedText.length > 50) {

// A:
if (extractedText && extractedText.length > 120) {
```

### Cambio 2 - Linea 186 (Trascrizione)
```typescript
// DA:
if (transcript && transcript.length > 50) {

// A:
if (transcript && transcript.length > 120) {
```

## Post-Modifica
1. Deploy immediato della funzione `extract-media-text`
2. Conferma all'utente per test manuale

## Vincoli Rispettati
- Nessuna modifica a componenti UI
- Nessuna modifica alla logica del Gate
- Nessuna modifica al sistema PULSE/Trust Score
- Fix chirurgico e isolato
