
# Implementazione: Sistema Sociale Completo per Reactions

## Panoramica

Questa evoluzione trasforma il sistema di reactions in un'esperienza sociale completa, ispirata a Facebook ma con lo stile minimale NoParrot:

1. **ReactionSummary** - Mostra fino a 3 emoji sovrapposte + conteggio totale
2. **ReactionsSheet** - Drawer con lista utenti filtrabili per tipo reazione
3. **Extended Reactions per Il Punto** - Long press + picker dinamico
4. **Optimistic UI** - Aggiornamento istantaneo del ReactionSummary

---

## Architettura Tecnica

### Nuovi Componenti

| Componente | Descrizione |
|------------|-------------|
| `ReactionSummary.tsx` | Pill con 3 emoji sovrapposte + count, cliccabile |
| `ReactionsSheet.tsx` | Drawer bottom con tabs filtro e lista utenti |

### Nuovo Hook

| Hook | Descrizione |
|------|-------------|
| `usePostReactors.ts` | Query per recuperare utenti che hanno reagito a un post |

### Database Query

Le reactions sono già memorizzate nella tabella `reactions` con:
- `post_id`, `user_id`, `reaction_type`, `created_at`

Query per recuperare gli utenti:
```sql
SELECT r.*, p.username, p.full_name, p.avatar_url
FROM reactions r
JOIN public_profiles p ON r.user_id = p.id
WHERE r.post_id = $1
ORDER BY r.created_at DESC
```

---

## Task 1: ReactionSummary Component

### Design UI

```text
┌─────────────────────────────────────┐
│  ❤️😂🔥  15 reazioni                │
│  └──┬──┘                            │
│     │                               │
│   Emoji sovrapposte (z-index stack) │
│   margin-left negativo (-4px)       │
└─────────────────────────────────────┘
```

### File: `src/components/feed/ReactionSummary.tsx`

```typescript
interface ReactionSummaryProps {
  reactions: Array<{ type: ReactionType; count: number }>;
  totalCount: number;
  onClick?: () => void;
  className?: string;
}

// Logica:
// 1. Ordina reactions per count (desc)
// 2. Prendi le prime 3 uniche
// 3. Renderizza emoji con sovrapposizione
// 4. Mostra count totale
```

### Posizionamento

- **ImmersivePostCard**: Vicino al bottone Like, nella action bar
- **ImmersiveEditorialCarousel**: Stessa posizione, allineato

---

## Task 2: ReactionsSheet (Drawer Dettaglio)

### Design UI

```text
┌────────────────────────────────────────┐
│  ═══════  (handle)                     │
│                                        │
│  Reazioni (125)                        │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐│
│  │Tutti│ ❤️  │ 😂  │ 😮  │ 😢  │ 🔥  ││
│  │ 125 │ 80  │ 25  │ 10  │  5  │  5  ││
│  └─────┴─────┴─────┴─────┴─────┴─────┘│
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 👤  @username    full_name   ❤️  │ │
│  │ 👤  @user2       Nome User   😂  │ │
│  │ 👤  @user3       Mario R.    🔥  │ │
│  │ ...                               │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### File: `src/components/feed/ReactionsSheet.tsx`

```typescript
interface ReactionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  focusId?: string;  // Per supportare anche Il Punto
  focusType?: 'daily' | 'interest';
}

// Features:
// - Tabs per filtrare (Tutti, ❤️, 😂, 😮, 😢, 🔥)
// - Count per tab
// - Lista scrollabile
// - Avatar con emoji badge
// - Click su riga → naviga a profilo
```

### Struttura Tab

Usa `Tabs` component esistente con styling custom per emoji:
```typescript
<Tabs defaultValue="all">
  <TabsList className="flex gap-1 overflow-x-auto">
    <TabsTrigger value="all">Tutti ({total})</TabsTrigger>
    <TabsTrigger value="heart">❤️ ({hearts})</TabsTrigger>
    <TabsTrigger value="laugh">😂 ({laughs})</TabsTrigger>
    {/* ... */}
  </TabsList>
</Tabs>
```

---

## Task 3: usePostReactors Hook

### File: `src/hooks/usePostReactors.ts`

```typescript
interface Reactor {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
  user: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ReactorsData {
  reactors: Reactor[];
  byType: Record<ReactionType, Reactor[]>;
  counts: Record<ReactionType, number>;
  totalCount: number;
}

export const usePostReactors = (postId: string | undefined) => {
  return useQuery({
    queryKey: ['post-reactors', postId],
    queryFn: async (): Promise<ReactorsData> => {
      const { data, error } = await supabase
        .from('reactions')
        .select(`
          id,
          user_id,
          reaction_type,
          created_at,
          user:public_profiles!user_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .neq('reaction_type', 'bookmark') // Escludi bookmarks
        .order('created_at', { ascending: false });

      // Processa e raggruppa per tipo
      // ...
    },
    enabled: !!postId,
  });
};
```

---

## Task 4: Extended Reactions per "Il Punto"

### Modifiche a `ImmersiveEditorialCarousel.tsx`

1. **Importare** `useLongPress` e `ReactionPicker`
2. **Aggiungere stato** per picker visibility
3. **Aggiornare** l'icona Like per mostrare l'emoji selezionata

```typescript
// Imports aggiunti
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker, reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";

// Nel componente EditorialSlideInner:
const [showReactionPicker, setShowReactionPicker] = useState(false);
const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);

const likeHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => onLike('heart'),  // Default
});

// Render Like button:
<div className="relative">
  <button {...likeHandlers}>
    {currentReaction ? (
      <span className="text-xl">{reactionToEmoji(currentReaction)}</span>
    ) : (
      <Heart className={cn(...)} />
    )}
  </button>
  <ReactionPicker
    isOpen={showReactionPicker}
    onClose={() => setShowReactionPicker(false)}
    onSelect={(type) => {
      setCurrentReaction(type);
      onLike(type);
    }}
    currentReaction={currentReaction}
  />
</div>
```

---

## Task 5: Optimistic UI per ReactionSummary

### Logica

Quando l'utente cambia reazione:
1. **Immediatamente**: Aggiorna il ReactionSummary con la nuova emoji
2. **Background**: Invalida query per sync con DB

### Modifiche a `usePosts.ts`

Estendere l'interfaccia `Post` per includere breakdown reazioni:
```typescript
reactions: {
  hearts: number;
  comments: number;
  byType?: Record<ReactionType, number>;  // NUOVO
};
```

Modificare la query per aggregare per tipo:
```typescript
// Nel mapping:
const reactionsByType = post.reactions?.reduce((acc, r) => {
  if (r.reaction_type !== 'bookmark') {
    acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
  }
  return acc;
}, {} as Record<string, number>) || {};
```

Aggiornare `onMutate` per aggiornare anche `byType`.

---

## Integrazione nei Componenti

### ImmersivePostCard.tsx

```typescript
// Dopo il bottone Like, aggiungere:
{totalReactions > 0 && (
  <ReactionSummary
    reactions={getTopReactions(post.reactions.byType)}
    totalCount={totalReactions}
    onClick={() => setShowReactionsSheet(true)}
  />
)}

// Alla fine del component:
<ReactionsSheet
  isOpen={showReactionsSheet}
  onClose={() => setShowReactionsSheet(false)}
  postId={post.id}
/>
```

### ImmersiveEditorialCarousel.tsx

Stessa struttura, usando `focusId` e `focusType` invece di `postId`.

---

## Riepilogo File da Creare/Modificare

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/components/feed/ReactionSummary.tsx` | **Nuovo** | Componente pill emoji + count |
| `src/components/feed/ReactionsSheet.tsx` | **Nuovo** | Drawer con tabs e lista utenti |
| `src/hooks/usePostReactors.ts` | **Nuovo** | Hook per query reactors |
| `src/hooks/useFocusReactors.ts` | **Nuovo** | Hook per query reactors focus |
| `src/hooks/usePosts.ts` | Modifica | Aggiungere `byType` alle reactions |
| `src/components/feed/ImmersivePostCard.tsx` | Modifica | Integrare ReactionSummary + Sheet |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Modifica | Long press + picker + summary |
| `src/components/ui/reaction-picker.tsx` | Modifica | Esportare helper per dynamic icon |

---

## Garanzie Anti-Regressione

| Garanzia | Dettaglio |
|----------|-----------|
| Deep Linking notifiche | Nessuna modifica a `/post/:id` navigation o `scrollTo` logic |
| SessionGuard intatto | Nessuna modifica a breadcrumbs o crash detection |
| Edge Functions | Nessuna modifica a classificazione cognitiva o push |
| Quiz gate | Nessuna modifica a runGateBeforeAction o QuizModal |
| Realtime | Nessuna modifica alle subscription esistenti |

---

## Ordine di Implementazione

1. **usePostReactors.ts** - Hook base per query
2. **ReactionSummary.tsx** - Componente UI summary
3. **ReactionsSheet.tsx** - Drawer dettaglio
4. **usePosts.ts** - Aggiungere byType + optimistic update
5. **ImmersivePostCard.tsx** - Integrare summary + sheet
6. **ImmersiveEditorialCarousel.tsx** - Long press + dynamic icon + summary

---

## Test Consigliati

1. **ReactionSummary display**: Verifica che mostri max 3 emoji ordinate per frequenza
2. **Click su summary**: Verifica apertura sheet con lista corretta
3. **Tab filtering**: Verifica che i tab filtrino correttamente
4. **Dynamic icon Il Punto**: Verifica che l'icona cambi dopo selezione emoji
5. **Optimistic update**: Verifica che il summary si aggiorni istantaneamente
6. **Navigate to profile**: Verifica che click su utente navighi a `/profile/:id`
7. **Empty state**: Verifica messaggio quando non ci sono reazioni

