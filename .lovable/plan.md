
# Piano: Fix Comprehension Gate + Bypass Autore Originale

## Obiettivo
1. Eliminare il **doppio quiz** (Feed Reader → Composer) passando un flag `_gatePassed: true`
2. **Bypassare il gate per l'autore originale** (chi ha scritto il post non deve fare quiz sul proprio contenuto)
3. Fixare il build error di `generate-vapid-keys`

---

## Modifiche Tecniche

### 1. TypeScript: Aggiungere `_gatePassed` all'interfaccia Post

**File**: `src/hooks/usePosts.ts` (linea 27)

```typescript
export interface Post {
  // ... campi esistenti ...
  _originalSources?: string[];
  /** Flag to bypass gate - set when quiz was already passed in Feed Reader */
  _gatePassed?: boolean;  // <-- NUOVO CAMPO OPZIONALE
  quoted_post?: { ... };
  // ...
}
```

---

### 2. ImmersivePostCard: Passare `_gatePassed: true` dopo quiz superato

**File**: `src/components/feed/ImmersivePostCard.tsx` (linee 1092-1093)

```typescript
// PRIMA
if (shareAction === 'feed') {
  onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
}

// DOPO
if (shareAction === 'feed') {
  onQuoteShare?.({ 
    ...post, 
    _originalSources: Array.isArray(post.sources) ? post.sources : [],
    _gatePassed: true  // Bypass gate nel Composer
  });
}
```

Stessa modifica per tutti gli altri punti dove viene chiamato `onQuoteShare` dopo quiz superato:
- Linea 931 (Intent post insufficient context)
- Linea 1008 (External source insufficient - fail-open)
- Linea 643 (goDirectlyToGateForPost)

---

### 3. ImmersivePostCard: Bypass Gate per Autore Originale (Share)

**File**: `src/components/feed/ImmersivePostCard.tsx`

Aggiungere controllo all'inizio di `startComprehensionGate` (linea ~659):

```typescript
const startComprehensionGate = async () => {
  if (!user) return;

  // [UX FIX] Bypass gate se l'utente corrente è l'autore del post
  // Non ha senso testare qualcuno sul proprio contenuto
  if (user.id === post.author.id) {
    console.log('[Gate] Bypassing gate - user is post author');
    addBreadcrumb('gate_bypass', { reason: 'author_is_user' });
    onQuoteShare?.({ 
      ...post, 
      _originalSources: Array.isArray(post.sources) ? post.sources : [],
      _gatePassed: true 
    });
    toast({ title: 'Post pronto per la condivisione' });
    return;
  }

  // ... resto della logica esistente ...
};
```

Stessa logica per `goDirectlyToGateForPost` e `handleShareAction`:

```typescript
const handleShareAction = async (action: 'feed' | 'friend') => {
  // Bypass immediato se sono l'autore
  if (user?.id === post.author.id) {
    if (action === 'feed') {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [], _gatePassed: true });
    } else {
      setShowPeoplePicker(true);
    }
    return;
  }
  // ... resto logica esistente ...
};
```

---

### 4. CommentsDrawer: Bypass Gate per Autore Originale (Commenti)

**File**: `src/components/feed/CommentsDrawer.tsx`

Modificare la logica di scelta commento (linea ~521):

```typescript
onFocus={() => {
  // [UX FIX] Se l'utente è l'autore del post, nessun gate necessario
  if (user?.id === post.author?.id) {
    console.log('[CommentsDrawer] Bypassing gate choice - user is author');
    // Salta la scelta, va diretto a "informed" senza quiz
    setSelectedCommentType('informed');
    return;
  }
  
  if (postHasSource && selectedCommentType === null && !showCommentTypeChoice) {
    setShowCommentTypeChoice(true);
    textareaRef.current?.blur();
  }
}}
```

E nella Dialog "Come vuoi entrare nella conversazione?", nasconderla se l'utente è l'autore:

```typescript
{/* Choice UI - Skip if user is author */}
{user?.id !== post.author?.id && (
  <Dialog open={showCommentTypeChoice} onOpenChange={setShowCommentTypeChoice}>
    {/* ... contenuto esistente ... */}
  </Dialog>
)}
```

---

### 5. ComposerModal: Bypass Gate quando `_gatePassed` è presente

**File**: `src/components/composer/ComposerModal.tsx`

**5a. Aggiornare `gateStatus`** (linea ~243):

```typescript
const gateStatus = (() => {
  // [FIX] Gate già superato nel Feed Reader
  if (quotedPost?._gatePassed === true) {
    return { label: 'Quiz già superato', requiresGate: false };
  }

  // Gate attivo se c'è un URL
  if (detectedUrl) {
    return { label: 'Gate attivo', requiresGate: true };
  }
  
  // ... resto logica esistente ...
})();
```

**5b. Aggiornare `handlePublish`** (linea ~465):

```typescript
const handlePublish = async () => {
  if (!user || (!content.trim() && !detectedUrl && uploadedMedia.length === 0 && !quotedPost)) return;
  
  addBreadcrumb('publish_attempt', { hasUrl: !!detectedUrl, hasMediaOCR: !!mediaWithExtractedText, isIOS });
  
  // [FIX] BYPASS GATE se l'utente ha già superato il quiz nel Feed Reader
  if (quotedPost?._gatePassed === true) {
    console.log('[Composer] Gate bypass - quiz already passed in Feed Reader');
    addBreadcrumb('gate_bypass', { reason: '_gatePassed' });
    await publishPost();
    return;
  }

  // ... resto logica esistente ...
};
```

---

### 6. Fix Build Error: generate-vapid-keys

**File**: `supabase/functions/generate-vapid-keys/index.ts`

Il problema è che Deno non trova il modulo npm. Dobbiamo usare l'import ESM corretto:

```typescript
// PRIMA
import webpush from "npm:web-push@3.6.7";

// DOPO - usa esm.sh per compatibilità Deno
import webpush from "https://esm.sh/web-push@3.6.7";
```

---

## Riepilogo Modifiche per File

| File | Modifiche |
|------|-----------|
| `src/hooks/usePosts.ts` | Aggiungere `_gatePassed?: boolean` all'interfaccia Post |
| `src/components/feed/ImmersivePostCard.tsx` | 1. Passare `_gatePassed: true` dopo quiz<br/>2. Bypass gate se `user.id === post.author.id` |
| `src/components/feed/CommentsDrawer.tsx` | Bypass scelta commento se `user.id === post.author.id` |
| `src/components/composer/ComposerModal.tsx` | 1. Bypass gateStatus se `quotedPost._gatePassed`<br/>2. Bypass handlePublish se `quotedPost._gatePassed` |
| `supabase/functions/generate-vapid-keys/index.ts` | Cambiare import a esm.sh |

---

## Test Cases

1. **Bypass autore - Share**:
   - Crea un post con link → clicca Condividi sul TUO post → deve bypassare il gate e aprire il Composer

2. **Bypass autore - Commenti**:
   - Sul TUO post con link → clicca per commentare → non deve apparire la scelta "spontaneo/consapevole"

3. **Doppio quiz fix**:
   - Condividi post di ALTRO utente con OCR → passa quiz nel Reader → Composer si apre → clicca Pubblica → NON deve chiedere un secondo quiz

4. **Gate normale funziona ancora**:
   - Condividi post di ALTRO utente con link → quiz deve apparire
   - Dopo aver passato il quiz → Composer bypassa il secondo gate
