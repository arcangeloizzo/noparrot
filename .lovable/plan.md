
# Piano: Sistema Reazioni Instagram Drawer

## Obiettivo
Trasformare la visualizzazione delle reazioni nell'app NoParrot da emoji stack sovrapposti a un conteggio testuale cliccabile che apre un Drawer (Bottom Sheet) con filtri per tipo di reazione e lista utenti con pulsante "Segui".

## Analisi Attuale

### Componenti Coinvolti
| Componente | Uso Attuale |
|------------|-------------|
| `ReactionSummary.tsx` | Mostra emoji stack sovrapposti + count (usato in 7+ luoghi) |
| `ReactionsSheet.tsx` | Drawer esistente con tab filtri e lista utenti (già funzionante) |
| `ImmersivePostCard.tsx` | Feed post - mostra ReactionSummary |
| `ImmersiveEditorialCarousel.tsx` | Editoriali "Il Punto" - mostra ReactionSummary |
| `CommentItem.tsx` | Commenti - mostra ReactionSummary |
| `CommentsDrawer.tsx` | Drawer commenti post |
| `CommentsSheet.tsx` | Sheet commenti focus |
| `MediaCommentsSheet.tsx` | Commenti media |

### Problema Identificato
Il `ReactionsSheet.tsx` esistente è già ben strutturato con:
- Tab orizzontali per filtrare per tipo di reazione
- Lista utenti con avatar, nome e username

**Manca solo**:
1. Sostituzione dello stack emoji con conteggio testuale
2. Aggiunta pulsante "Segui/Segui già" per ogni utente
3. Rimozione emoji badge sull'avatar (per aderire al design Instagram)
4. Applicazione globale della nuova UI

---

## Design Proposta

### Prima (Attuale)
```
[❤️😂🔥] 42
```

### Dopo (Instagram-style)
```
42 reazioni    ← Testo cliccabile
```
oppure
```
Piace a mario_rossi e altri 41
```

### Drawer Interno (Header con Filtri)
```
╭──────────────────────────────────────────╮
│ ⌢                                         │
│ Mi piace                                  │
│                                           │
│ [Tutti 42] [❤️ 30] [😂 8] [🔥 4]          │
│ ─────────────────────────────────────     │
│                                           │
│ 🔵 Mario Rossi                  [Segui]   │
│    @mario_rossi                           │
│                                           │
│ 🔵 Anna Verdi               [Segui già]   │
│    @anna_verdi                            │
│                                           │
│ ...                                       │
╰──────────────────────────────────────────╯
```

---

## Modifiche Tecniche

### 1. ReactionSummary.tsx - Refactoring Completo

Sostituire lo stack emoji con un conteggio testuale semplice:

```tsx
// PRIMA: Emoji stack sovrapposti
<div className="flex items-center">
  {topReactions.map((reaction, index) => (
    <span className="...emoji...">{reactionToEmoji(reaction.type)}</span>
  ))}
</div>

// DOPO: Conteggio testuale
<span className="text-sm text-muted-foreground">
  {totalCount} {totalCount === 1 ? 'reazione' : 'reazioni'}
</span>
```

Variante alternativa (stile "Piace a X e altri Y"):
```tsx
// Se esiste un primo reactor noto, mostrare nome
"Piace a {firstReactorName} e altri {count - 1}"
```

### 2. ReactionsSheet.tsx - Aggiunta Pulsante Segui

Aggiungere logica follow/unfollow al `ReactorRow`:

```tsx
const ReactorRow = ({ reactor, onClick, currentUserId }) => {
  // Nuovo: hook per verificare se seguo già questo utente
  const { data: isFollowing } = useIsFollowing(reactor.user_id);
  const toggleFollow = useToggleFollow();
  
  return (
    <div className="flex items-center gap-3 p-2">
      {/* Avatar SENZA badge emoji (stile Instagram) */}
      <Avatar className="w-11 h-11" onClick={onClick}>
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      
      {/* User info */}
      <div className="flex-1 min-w-0" onClick={onClick}>
        <p className="font-semibold text-sm">{displayName}</p>
        <p className="text-xs text-muted-foreground">@{username}</p>
      </div>
      
      {/* NUOVO: Pulsante Segui (non mostrato se è l'utente corrente) */}
      {currentUserId !== reactor.user_id && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          className="rounded-full h-8 px-4 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            toggleFollow.mutate({ targetUserId: reactor.user_id });
          }}
        >
          {isFollowing ? "Segui già" : "Segui"}
        </Button>
      )}
    </div>
  );
};
```

### 3. Hooks Necessari - useIsFollowing e useToggleFollow

Creare o riutilizzare hooks per gestire il follow:

```tsx
// src/hooks/useFollow.ts
export const useIsFollowing = (targetUserId: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-following', user?.id, targetUserId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetUserId && user.id !== targetUserId,
  });
};

export const useToggleFollow = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ targetUserId }: { targetUserId: string }) => {
      const isFollowing = queryClient.getQueryData(['is-following', user?.id, targetUserId]);
      if (isFollowing) {
        await supabase.from('followers').delete()
          .eq('follower_id', user!.id)
          .eq('following_id', targetUserId);
      } else {
        await supabase.from('followers').insert({
          follower_id: user!.id,
          following_id: targetUserId,
        });
      }
    },
    onSuccess: (_, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetUserId] });
    },
  });
};
```

### 4. Aggiornamento Punti di Utilizzo

Ogni utilizzo di `ReactionSummary` deve essere aggiornato per passare il contesto necessario.

**File da modificare:**
| File | Modifica |
|------|----------|
| `ImmersivePostCard.tsx` | Sostituire `ReactionSummary` con nuovo formato testuale |
| `ImmersiveEditorialCarousel.tsx` | Idem |
| `CommentItem.tsx` | Idem per commenti |
| `CommentsDrawer.tsx` | Idem |
| `CommentsSheet.tsx` | Idem |
| `MediaCommentsSheet.tsx` | Idem |
| `PostCommentsView.tsx` | Idem |

### 5. Stile Drawer Conforme al Tema

Mantenere tema scuro NoParrot:
- Background: `bg-[#0E141A]` / `zinc-900/950`
- Border: `border-white/10`
- Tab attivo: `bg-primary/10 text-primary`
- Tab inattivo: `bg-white/5 text-muted-foreground`
- Hover states: `hover:bg-white/5`

---

## File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| `src/hooks/useFollow.ts` | **CREARE** | Hooks per isFollowing e toggleFollow |
| `src/components/feed/ReactionSummary.tsx` | Modificare | Cambiare da emoji stack a testo |
| `src/components/feed/ReactionsSheet.tsx` | Modificare | Aggiungere pulsante Segui, rimuovere badge emoji |
| `src/components/feed/ImmersivePostCard.tsx` | Modificare | Passare currentUserId al ReactionsSheet |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Modificare | Idem |
| `src/components/feed/CommentItem.tsx` | Verificare | Potrebbe necessitare ReactionsSheet per commenti |

---

## Garanzie Zero-Regressione

| Sistema | Status |
|---------|--------|
| Comprehension Gate | Non toccato |
| Sistema commenti (CRUD) | Non toccato |
| OCR / Trascrizione | Non toccato |
| Logica reazioni (toggle, persist) | Non toccata |
| ReactionPicker (long press) | Non toccato |

---

## Risultato Atteso

1. **Feed Post**: Al posto dello stack `[❤️😂🔥] 42` → testo `42 reazioni` cliccabile
2. **Click su conteggio**: Apre Drawer con header filtri emoji + count
3. **Lista utenti**: Avatar, Nome completo, @username, pulsante "Segui"/"Segui già"
4. **Tab filtri**: Solo reazioni con count > 0 visibili
5. **Stesso comportamento**: Applicato a Post, Editoriali, Commenti
6. **Tema coerente**: Zinc-900/950, glassmorphism, urban texture
