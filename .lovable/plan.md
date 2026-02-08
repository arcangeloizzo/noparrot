
# Piano: Risoluzione Bug Enhanced Reactions

## Problemi Identificati

### Problema 1: Rimozione Enhanced Reaction Richiede Due Click
**Sintomo**: Quando un utente ha una reaction enhanced (es. 🔥) e clicca sul cuore, l'icona non diventa vuota immediatamente ma si comporta come un click normale (cambiando la reaction a "heart"), richiedendo un secondo click per rimuoverla.

**Causa Root**: In `ImmersivePostCard.tsx` riga 483, il tap handler chiama sempre `handleHeart(undefined, 'heart')`:
```typescript
onTap: () => handleHeart(undefined, 'heart'),
```
Questo significa che quando l'utente ha una reaction enhanced (es. `fire`) e tocca il pulsante, invece di rimuovere la reaction, il codice sta effettivamente chiamando un **switch** da `fire` a `heart`.

**Soluzione**: Il tap handler deve verificare `myReactionType` corrente e chiamare `handleHeart` con lo stesso tipo per triggerare la rimozione:
```typescript
onTap: () => {
  const currentType = post.user_reactions?.myReactionType || 'heart';
  handleHeart(undefined, currentType);
}
```

### Problema 2: Scroll del Feed Durante Selezione Emoji
**Sintomo**: Quando il picker e aperto e l'utente muove il dito per selezionare un'emoji, il feed sottostante scrolla.

**Causa Root**: Il reaction picker usa `pointer-events-none` sullo shield in drag mode (riga 302 e 338 di `reaction-picker.tsx`), permettendo ai touch events di propagarsi al feed sottostante. Inoltre, il `touchmove` non viene gestito per bloccare lo scroll del container.

**Soluzione**:
1. Rimuovere `pointer-events-none` dallo shield in drag mode
2. Aggiungere `touch-action: none` sul picker per prevenire lo scroll
3. Bloccare lo scroll del feed quando il picker e aperto usando `overflow: hidden` sul body o container

### Problema 3: Conteggio Duplicato Like / Utenti Multipli nel Drawer
**Sintomo**: A volte dopo aver selezionato una reaction enhanced e provato a rimuoverla, il sistema conta 2 like e nel drawer si vede lo stesso utente piu volte.

**Causa Root**: Il database ha vincoli corretti e non ci sono duplicati effettivi. Il problema e nell'**optimistic update** in `usePosts.ts`:
- Il codice non invalida correttamente la query `post-reactors` dopo una mutation
- L'optimistic update aggiorna `byType` ma non tiene conto di tutte le cache key coinvolte
- Potenziale race condition quando si fa switch tra reaction types

**Soluzione**:
1. Invalidare `['post-reactors', postId]` in `onSettled` della mutation
2. Migliorare l'optimistic update per gestire correttamente lo switch tra reaction types
3. Assicurarsi che `onError` faccia rollback completo

## Modifiche Tecniche

### File 1: `src/components/feed/ImmersivePostCard.tsx`

**Modifica 1**: Fix tap handler per rimuovere reaction corrente (righe 481-486)

```typescript
// PRIMA
const likeButtonHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => handleHeart(undefined, 'heart'),
  onMove: (x, y) => setDragPosition({ x, y }),
  onRelease: () => setDragPosition(null),
});

// DOPO
const likeButtonHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => {
    // Se esiste una reaction, usala per il toggle (rimuove)
    // Altrimenti usa 'heart' per aggiungere un nuovo like
    const currentType = post.user_reactions?.myReactionType || 'heart';
    handleHeart(undefined, currentType);
  },
  onMove: (x, y) => setDragPosition({ x, y }),
  onRelease: () => setDragPosition(null),
});
```

**Modifica 2**: Bloccare scroll quando picker e aperto (aggiungere useEffect)

```typescript
// Blocca scroll del feed quando il reaction picker e aperto
useEffect(() => {
  if (showReactionPicker) {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }
}, [showReactionPicker]);
```

### File 2: `src/components/ui/reaction-picker.tsx`

**Modifica 1**: Rimuovere `pointer-events-none` dallo shield e aggiungere touch-action (righe 300-307 e 336-343)

```typescript
// PRIMA
<div 
  className={cn("fixed inset-0 z-[9998]", dragPosition !== undefined && "pointer-events-none")}
  onClick={handleShieldInteraction}
  ...
/>

// DOPO - Lo shield deve SEMPRE intercettare gli eventi touch
<div 
  className="fixed inset-0 z-[9998]"
  style={{ touchAction: 'none' }}
  onClick={handleShieldInteraction}
  onTouchStart={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onTouchMove={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onTouchEnd={handleShieldInteraction}
/>
```

**Modifica 2**: Aggiungere touch-action: none al container del picker (righe 311-321 e 345-358)

```typescript
<div
  ref={containerRef}
  className={cn(...)}
  style={{
    ...positionStyle,
    touchAction: 'none',  // Previene scroll durante drag
  }}
>
```

### File 3: `src/hooks/usePosts.ts`

**Modifica 1**: Invalidare query `post-reactors` in onSettled (dopo riga ~450)

```typescript
onSettled: (data, error, { postId }) => {
  // Sempre invalida post-reactors per sincronizzare il drawer delle reazioni
  queryClient.invalidateQueries({ queryKey: ['post-reactors', postId] });
},
```

**Modifica 2**: Fix optimistic update per single post query (righe 403-420)

Il codice attuale non gestisce correttamente il passaggio tra reaction types per la query `['post', postId]`. Deve usare la stessa logica dell'update per `['posts', user.id]`.

### File 4: `src/hooks/useLongPress.ts`

**Modifica**: Prevenire propagazione scroll durante long press (righe 87-89)

```typescript
onTouchMove: (e: React.TouchEvent) => {
  // Previeni scroll quando long press e attivo
  if (isLongPressRef.current) {
    e.preventDefault();
    e.stopPropagation();
  }
  const touch = e.touches[0];
  move(touch.clientX, touch.clientY);
},
```

## Ordine di Implementazione

1. **Fix tap handler** in `ImmersivePostCard.tsx` - risolve il problema principale della rimozione
2. **Fix scroll blocking** in `useLongPress.ts` e `reaction-picker.tsx` - risolve lo scroll durante drag
3. **Fix invalidation** in `usePosts.ts` - risolve i conteggi duplicati nel drawer
4. **Aggiungi body scroll lock** in `ImmersivePostCard.tsx` - protezione aggiuntiva

## Test Cases

1. **Rimozione enhanced reaction**:
   - Aggiungi reaction 🔥 → clicca cuore → icona deve diventare vuota (non cambiare a ❤️)
   - Aggiungi reaction 😂 → clicca cuore → icona deve diventare vuota
   
2. **Scroll blocking**:
   - Long press cuore → picker si apre → muovi dito per selezionare emoji → feed NON deve scrollare

3. **Conteggio corretto**:
   - Aggiungi reaction → apri drawer → verifica 1 solo utente
   - Cambia reaction → apri drawer → verifica 1 solo utente (non 2)
   - Rimuovi reaction → conteggio deve decrementare di 1
