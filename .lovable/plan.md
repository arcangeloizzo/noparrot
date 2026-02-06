
# Piano: Fix Visualizzazione Media nei Post Ricondivisi

## Problema Identificato

Quando un utente ricondivide un post con **immagini o carousel** (senza URL esterna), i media non vengono visualizzati nel feed. Questo accade perché:

1. La logica `useStackLayout` si attiva quando il commento del post citato ha < 30 parole
2. In modalità stack, viene mostrato solo `ReshareContextStack` che non include i media
3. Il `QuotedPostCard` (che supporta la visualizzazione dei media) viene saltato

### Esempi Concreti dal Database
- Post con carousel di 6 immagini e contenuto vuoto → `useStackLayout = true` → nessun media visibile
- Post con 1 immagine e commento corto → `useStackLayout = true` → nessun media visibile

## Analisi del Codice

Il problema è nella logica di ImmersivePostCard.tsx:

```text
useStackLayout = !isQuotedIntentPost && (isReshareWithShortComment || isReshareWithSource)
```

Dove:
- `isReshareWithShortComment` = commento quoted post < 30 parole
- `isReshareWithSource` = quoted post ha una URL

Quando `useStackLayout = true`, viene mostrato `ReshareContextStack` invece di `QuotedPostCard`, perdendo i media.

## Soluzione

Aggiungere una nuova condizione che forza la visualizzazione del `QuotedPostCard` quando il post citato ha media, indipendentemente dalla lunghezza del commento.

### Modifiche a ImmersivePostCard.tsx

Aggiungere un flag per rilevare se il quoted post ha media:

```typescript
const quotedPostHasMedia = quotedPost?.media && quotedPost.media.length > 0;
```

Modificare la visualizzazione del QuotedPostCard per mostrarlo ANCHE quando il quoted post ha media:

```typescript
// Quoted Post - Show for:
// 1. Reshares WITHOUT source and without stack layout (pure comment reshares)
// 2. Reshares WITH MEDIA (always show to display images/carousel)
{quotedPost && (!useStackLayout || quotedPostHasMedia) && (
  <div className="mt-4">
    {/* ...existing rendering logic... */}
  </div>
)}
```

### Modifiche a ReshareContextStack

Per evitare duplicazione quando viene mostrato sia lo stack che il QuotedPostCard, si può:

**Opzione A**: Mostrare lo stack SOLO per il contesto della catena, e il `QuotedPostCard` per il post originale con i media
  - Pro: Mantiene la visualizzazione della catena di reshare
  - Contro: Può sembrare ridondante

**Opzione B (consigliata)**: Non mostrare lo stack quando il quoted post ha media (mostra solo QuotedPostCard)
  - Pro: Layout più pulito, i media sono chiari
  - Contro: Si perde la visualizzazione della catena per questi casi

### Implementazione Opzione B

```typescript
// Linea 1363 - condizione per ReshareContextStack
{quotedPost && contextStack.length > 0 && !isQuotedIntentPost && !quotedPostHasMedia && (
  <ReshareContextStack stack={contextStack} />
)}

// Linea 2001 - condizione per QuotedPostCard
{quotedPost && (!useStackLayout || quotedPostHasMedia) && (
  // ...existing QuotedPostCard rendering
)}
```

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/feed/ImmersivePostCard.tsx` | Aggiungere flag `quotedPostHasMedia` e modificare condizioni di rendering |

## Flusso Corretto Dopo il Fix

```text
PRIMA (BUG)                         DOPO (FIX)
                                    
Reshare di post con immagine:       Reshare di post con immagine:
1. useStackLayout = true            1. quotedPostHasMedia = true
2. Mostra ReshareContextStack       2. Mostra QuotedPostCard con media
3. Nessun media visibile            3. Immagine/carousel visibile

Reshare di post solo testo:         Reshare di post solo testo:
1. useStackLayout = true            1. useStackLayout = true (invariato)
2. Mostra ReshareContextStack       2. Mostra ReshareContextStack
3. Corretto (nessun media)          3. Corretto (invariato)
```

## Test di Verifica

1. **Reshare post con singola immagine**: L'immagine deve essere visibile nel feed
2. **Reshare post con carousel**: Il carousel deve essere visibile con navigazione
3. **Reshare post con URL**: Comportamento invariato (stack layout per URL)
4. **Reshare post solo testo**: Comportamento invariato (stack layout se < 30 parole)
5. **Reshare di Intent post**: Comportamento invariato (no stack, QuotedPostCard con layout intent)
