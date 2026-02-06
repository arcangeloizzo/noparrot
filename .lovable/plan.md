
# Piano: Fix Bug Double-Test su Reshare di Post con Immagini/Carousel

## Problema Identificato

Quando un utente condivide un post con immagini o carousel:
1. **Nel Feed**: Clicca "Condividi" → Reader si apre → Supera il quiz
2. **Composer si apre**: Ma il quiz viene richiesto UNA SECONDA VOLTA!
3. **Per carousel con testo >30 parole**: Il secondo tentativo fallisce con errore "Testo insufficiente" perche il sistema cerca di rigenerare il quiz senza i dati originali

### Causa Radice
Quando il quiz viene superato nel feed, `onQuoteShare?.({ ...post })` passa il post al composer SENZA indicare che il gate e gia stato superato. Il `ComposerModal` quindi:
- Rileva `quotedPost` con media/testo
- Calcola `gateStatus.requiresGate = true`  
- Al click su "Pubblica", richiede il test una seconda volta

## Soluzione

Aggiungere un flag `_gatePassed: true` al post quando il quiz viene superato, e modificare il ComposerModal per riconoscere questo flag e saltare completamente il gate.

## Modifiche Tecniche

### 1. ImmersivePostCard.tsx

Quando il quiz viene passato, includere il flag `_gatePassed` nel post:

```typescript
// Riga ~1075-1076
if (passed) {
  // ...existing code...
  if (shareAction === 'feed') {
    onQuoteShare?.({ 
      ...post, 
      _originalSources: Array.isArray(post.sources) ? post.sources : [],
      _gatePassed: true  // <-- NUOVO FLAG
    });
  }
}
```

### 2. FeedCardAdapt.tsx

Stesso fix per la versione non-immersiva:

```typescript
// Riga ~649
if (shareAction === 'feed') {
  onQuoteShare?.({
    ...post,
    _originalSources: Array.isArray(post.sources) ? post.sources : [],
    _gatePassed: true  // <-- NUOVO FLAG
  });
}
```

### 3. ComposerModal.tsx

#### a) Aggiornare `gateStatus` per riconoscere `_gatePassed`

```typescript
// Riga ~243 - All'inizio del calcolo gateStatus
const gateStatus = (() => {
  // BYPASS: Se il gate e gia stato passato nel feed, skip
  if (quotedPost?._gatePassed) {
    return { label: 'Gate gia superato', requiresGate: false };
  }
  
  // ...existing logic...
})();
```

#### b) Aggiornare `handlePublish` per saltare il gate se `_gatePassed`

```typescript
// Riga ~600 (inizio branch reshare)
// [FIX] Se gate gia passato nel feed, pubblica direttamente
if (quotedPost && quotedPost._gatePassed) {
  console.log('[Composer] Gate already passed in feed, publishing directly');
  addBreadcrumb('reshare_gate_bypassed', { gatePassed: true });
  await publishPost();
  return;
}
```

### 4. Tipi TypeScript (opzionale ma consigliato)

Estendere l'interfaccia Post per includere i nuovi flag interni:

```typescript
// In usePosts.ts o dove e definita l'interfaccia Post
interface Post {
  // ...existing fields...
  _gatePassed?: boolean;    // Flag interno - gate superato nel feed
  _originalSources?: string[]; // Flag interno - fonti originali
}
```

## Flusso Corretto Dopo il Fix

```text
PRIMA (BUG)                         DOPO (FIX)
                                    
1. Click Condividi                  1. Click Condividi
2. Reader si apre                   2. Reader si apre
3. Quiz                             3. Quiz
4. Supera quiz                      4. Supera quiz
5. Composer si apre                 5. Composer si apre (con _gatePassed=true)
6. ❌ Richiede quiz ANCORA          6. ✅ Click Pubblica
7. Errore/Doppio test               7. ✅ Post pubblicato senza secondo quiz
```

## Test di Verifica

1. **Post con singola immagine**:
   - Condividi → Reader → Quiz → Supera → Composer → Pubblica → Nessun secondo quiz

2. **Post con carousel (2+ immagini)**:
   - Stesso flusso, nessun errore "Testo insufficiente"

3. **Post con testo >120 parole senza media**:
   - Stesso flusso, nessun doppio quiz

4. **Reshare di Intent post**:
   - Gate bypassato se gia superato

5. **Post senza gate richiesto** (≤30 parole, no media OCR):
   - Comportamento invariato (no gate in entrambi i punti)

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/feed/ImmersivePostCard.tsx` | Aggiungere `_gatePassed: true` in `handleQuizSubmit` |
| `src/components/feed/FeedCardAdapt.tsx` | Aggiungere `_gatePassed: true` in `handleQuizSubmit` |
| `src/components/composer/ComposerModal.tsx` | Riconoscere `_gatePassed` e bypassare gate |

## Note di Sicurezza

- Il flag `_gatePassed` e un flag client-side temporaneo usato solo durante il flusso di navigazione
- La validazione del quiz rimane server-side tramite `submit-qa`
- Non introduce vulnerabilita perche:
  - Il quiz deve comunque essere superato nel feed
  - Il server ha gia registrato il superamento
  - Il flag viene perso al refresh/navigazione (comportamento desiderato)
