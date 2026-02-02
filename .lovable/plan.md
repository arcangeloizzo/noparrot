
# Piano: Fix ReactionPicker Touch + Database Constraint + Conteggio

## Diagnosi Confermata

### Problema 1: ReactionPicker sparisce al rilascio dito (iOS)
Lo shield Z-index ha un `onClick` che chiama `onClose()`. Su iOS, quando l'utente rilascia il dito dopo il long-press, il `touchend` viene interpretato come click sullo shield e chiude immediatamente il picker.

### Problema 2: Database CHECK CONSTRAINT blocca reazioni estese
Query di verifica ha confermato:
```sql
reactions_reaction_type_check: CHECK (reaction_type = ANY (ARRAY['heart'::text, 'bookmark'::text]))
focus_reactions_reaction_type_check: CHECK (reaction_type = ANY (ARRAY['heart'::text, 'bookmark'::text]))
```
Quando il codice prova a inserire `'laugh'`, `'wow'`, `'sad'`, `'fire'`, il database rifiuta con errore constraint.

### Problema 3: Conteggio `hearts` include solo cuori
In `usePosts.ts` riga 182:
```typescript
hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0
```
Questo conta SOLO i cuori, non le altre reazioni.

---

## Soluzione

### Parte 1: Database Migration

Estendere i CHECK constraint per accettare tutti i tipi di reazione:

```sql
-- Estendi constraint per focus_reactions
ALTER TABLE public.focus_reactions 
  DROP CONSTRAINT IF EXISTS focus_reactions_reaction_type_check;

ALTER TABLE public.focus_reactions 
  ADD CONSTRAINT focus_reactions_reaction_type_check 
  CHECK (reaction_type IN ('heart', 'bookmark', 'laugh', 'wow', 'sad', 'fire'));

-- Estendi constraint per reactions (posts)
ALTER TABLE public.reactions 
  DROP CONSTRAINT IF EXISTS reactions_reaction_type_check;

ALTER TABLE public.reactions 
  ADD CONSTRAINT reactions_reaction_type_check 
  CHECK (reaction_type IN ('heart', 'bookmark', 'laugh', 'wow', 'sad', 'fire'));
```

### Parte 2: Fix ReactionPicker Touch Handling

Aggiungere uno stato `isInteracting` che blocca la chiusura per 300ms dopo l'apertura del picker. Questo impedisce che il rilascio del dito dopo il long-press chiuda immediatamente il picker.

**File: `src/components/ui/reaction-picker.tsx`**

```tsx
const [isInteracting, setIsInteracting] = React.useState(false);

// Reset interacting state when picker opens
React.useEffect(() => {
  if (isOpen) {
    setIsInteracting(true);
    const timer = setTimeout(() => setIsInteracting(false), 300);
    return () => clearTimeout(timer);
  }
}, [isOpen]);

const handleShieldInteraction = (e: React.MouseEvent | React.TouchEvent) => {
  e.stopPropagation();
  e.preventDefault();
  // Only close if we're not in the initial "interacting" phase
  if (!isInteracting) {
    onClose();
  }
};
```

Inoltre, i bottoni emoji useranno `onTouchEnd` per catturare tap su iOS:

```tsx
<button
  onTouchEnd={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(reaction.type);
  }}
  onClick={(e) => {
    e.stopPropagation();
    handleSelect(reaction.type);
  }}
>
```

### Parte 3: Fix Conteggio Hearts

Modificare `usePosts.ts` per contare TUTTE le reazioni non-bookmark:

**Prima:**
```typescript
hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
```

**Dopo:**
```typescript
hearts: post.reactions?.filter((r: any) => 
  r.reaction_type && r.reaction_type !== 'bookmark'
).length || 0,
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| **Database Migration** | DROP + ADD constraint per entrambe le tabelle |
| `src/components/ui/reaction-picker.tsx` | Stato `isInteracting` + fix touch events |
| `src/hooks/usePosts.ts` | Conteggio hearts include tutte le reazioni non-bookmark |

---

## Garanzie Zero-Regressione

| Sistema | Status |
|---------|--------|
| Bookmark logic | Invariata (reaction_type = 'bookmark' rimane separato) |
| Comprehension Gate | Non toccato |
| RLS Security | Non toccata |
| Deep Linking | Non toccato |
| ReactionsSheet | Non toccato |
| Colore `text-destructive` per cuore | Mantenuto |

---

## Risultato Atteso

1. **Picker rimane aperto**: Rilasciando il dito dopo long-press, il picker resta visibile per 300ms minimo
2. **Selezione emoji funziona**: Toccando un'emoji su iOS, viene salvata nel database senza errori
3. **Contatore corretto**: Il numero totale include 🔥😂😮😢❤️
4. **Persistenza**: Ricaricando la pagina, l'emoji scelta rimane visibile
