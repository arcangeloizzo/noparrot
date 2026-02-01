
# Piano: Fix Crash "undefined is not an object (evaluating 'Object.keys(e.reactions.byType)')"

## Diagnosi del Problema

L'errore si verifica in `ImmersivePostCard.tsx` alla linea 2041 dove manca il null check per `post.reactions.byType`:

```tsx
// PROBLEMA - Nessun null check
{Object.keys(post.reactions.byType).length > 0 && (
```

Questo causa un crash quando:
1. Un post appena pubblicato viene aggiunto al feed prima che `reactions` sia completamente popolato
2. Il cache viene aggiornato ma `post.reactions` o `byType` sono undefined
3. Il componente si ri-renderizza durante una transizione (es. dopo aver condiviso da CommentsSheet)

## Soluzione

Aggiungere null checks difensivi in `ImmersivePostCard.tsx`:

```tsx
// FIX - Null check sicuro
{post.reactions?.byType && Object.keys(post.reactions.byType).length > 0 && (
```

E per la riga 2055 dove usa `post.reactions.comments`:
```tsx
<span className="text-sm font-bold text-white">{post.reactions?.comments || 0}</span>
```

## File da Modificare

**`src/components/feed/ImmersivePostCard.tsx`**:

1. Linea 2041: Aggiungere null check per `post.reactions?.byType`
2. Linea 2044: Aggiungere fallback per `Object.values`
3. Linea 2055: Aggiungere fallback per `post.reactions?.comments`

## Verifica Preventiva

Controlleremo se esistono altri punti nel file dove `post.reactions` viene usato senza null check.

## Test Consigliato

Dopo il fix:
1. Condividere un post dal flusso commenti
2. Completare il test di comprensione
3. Pubblicare dal composer
4. Verificare che non appaia il messaggio di errore

## Nota Tecnica

Questo è un pattern difensivo che dovrebbe essere applicato ovunque `post.reactions` viene usato, specialmente quando il post può essere in uno stato intermedio (appena creato, cache ottimistico non ancora sincronizzato, ecc.).
