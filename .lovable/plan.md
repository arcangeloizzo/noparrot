
# Piano: Soluzione Strutturale Sistema Reazioni

## Diagnosi Confermata

Dopo analisi approfondita del codice, confermo che la soluzione proposta è corretta e necessaria:

### Bug 1: Conflitto Gesture (Touch)
**Stato attuale:**
- `select-none` applicato solo a elementi singoli, non all'intera action bar
- Manca `-webkit-tap-highlight-color: transparent` per iOS
- Nessun isolamento z-index durante l'apertura del ReactionPicker

### Bug 2: Persistenza Focus Reactions (CRITICAL)
**Trovato in `useFocusReactions.ts` righe 77-85:**
```typescript
// BUG: Cerca reazione con lo STESSO reaction_type
const { data: existing } = await supabase
  .from('focus_reactions')
  .select('id')
  .eq('focus_id', focusId)
  .eq('focus_type', focusType)
  .eq('user_id', user.id)
  .eq('reaction_type', reactionType) // ← PROBLEMA!
```
Quando l'utente cambia da 🔥 a ❤️, il sistema non trova la reazione esistente e ne crea una NUOVA invece di fare UPDATE. Questo causa duplicati e comportamenti erratici.

---

## Soluzione Implementativa

### Parte 1: Isolamento Totale Touch (CSS Globale)

**File: `src/index.css`**

Aggiungere regola globale per eliminare highlight blu iOS su tutti gli elementi interattivi:

```css
/* Touch isolation for action bars */
.action-bar-zone {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}

/* Prevent text selection on reaction counters globally */
.reaction-count {
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
```

### Parte 2: Z-Index Shield nel ReactionPicker

**File: `src/components/ui/reaction-picker.tsx`**

Quando il picker è aperto, montare un overlay invisibile full-screen che blocca altri eventi:

```tsx
return (
  <>
    {/* Invisible shield to block other interactions */}
    <div 
      className="fixed inset-0 z-40" 
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onTouchStart={(e) => e.stopPropagation()}
    />
    
    {/* Actual picker - above shield */}
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 flex items-center gap-1 px-2 py-1.5",
        "bg-popover/95 backdrop-blur-xl border border-border/50",
        "rounded-full shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' }}
    >
      {/* emoji buttons */}
    </div>
  </>
);
```

### Parte 3: Applicare `action-bar-zone` ai Componenti

**File: `ImmersivePostCard.tsx` (riga ~2014)**
```tsx
{/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
<div className="flex items-center gap-4 h-11 action-bar-zone">
```

**File: `ImmersiveEditorialCarousel.tsx` (riga ~622)**
```tsx
{/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
<div className="flex items-center gap-4 h-11 action-bar-zone">
```

**File: `CommentItem.tsx`**
```tsx
{/* Footer actions */}
<div className="flex items-center gap-1 action-bar-zone">
```

### Parte 4: Fix Persistenza Focus Reactions (CRITICAL)

**File: `src/hooks/useFocusReactions.ts`**

Correggere la mutation per usare la stessa logica di `usePosts.ts` (switch/update invece di delete+insert):

```typescript
mutationFn: async ({ focusId, focusType, reactionType = 'heart' }: FocusReactionData) => {
  if (!user) throw new Error('User not authenticated');

  // Cerca qualsiasi reazione esistente (non filtrare per reaction_type!)
  const { data: existing } = await supabase
    .from('focus_reactions')
    .select('id, reaction_type')
    .eq('focus_id', focusId)
    .eq('focus_type', focusType)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Same type -> toggle off (delete)
      await supabase.from('focus_reactions').delete().eq('id', existing.id);
      return { action: 'removed' as const, previousType: existing.reaction_type };
    } else {
      // Different type -> switch (update)
      await supabase
        .from('focus_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id);
      return { action: 'switched' as const, previousType: existing.reaction_type };
    }
  } else {
    // No existing -> add new
    await supabase.from('focus_reactions').insert({
      focus_id: focusId,
      focus_type: focusType,
      user_id: user.id,
      reaction_type: reactionType,
    });
    return { action: 'added' as const };
  }
}
```

### Parte 5: Sync `currentReaction` con Server State

**File: `src/components/feed/ImmersiveEditorialCarousel.tsx`**

Aggiungere useEffect per sincronizzare lo stato locale con i dati del server:

```tsx
// Sync currentReaction with server data when available
useEffect(() => {
  if (reactionsData?.myReactionType) {
    setCurrentReaction(reactionsData.myReactionType);
  } else if (!reactionsData?.likedByMe) {
    setCurrentReaction(null);
  }
}, [reactionsData?.myReactionType, reactionsData?.likedByMe]);
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/index.css` | Aggiungere `.action-bar-zone` e `.reaction-count` classes |
| `src/components/ui/reaction-picker.tsx` | Aggiungere shield overlay invisibile |
| `src/hooks/useFocusReactions.ts` | Fix mutation per switch invece di delete+insert |
| `src/components/feed/ImmersivePostCard.tsx` | Applicare `action-bar-zone` |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Applicare `action-bar-zone` + sync useEffect |
| `src/components/feed/CommentItem.tsx` | Applicare `action-bar-zone` |

---

## Garanzie Zero-Regressione

| Sistema | Status |
|---------|--------|
| Comprehension Gate | Non toccato |
| RLS Security | Non toccata |
| Deep Linking | Non toccato |
| ReactionsSheet (drawer) | Non toccato |
| Colore `text-destructive` per cuore | Mantenuto |
| Logica bookmark | Invariata |

---

## Risultato Atteso

1. **Zero macchie blu**: `-webkit-tap-highlight-color: transparent` elimina ogni highlight iOS
2. **Nessuna interferenza**: Shield overlay isola il ReactionPicker dagli altri elementi
3. **Persistenza corretta**: UPDATE invece di DELETE+INSERT garantisce che l'emoji scelta rimanga
4. **Sync affidabile**: useEffect sincronizza stato locale con database
5. **UX fluida**: Long-press apre picker senza selezioni accidentali di testo
