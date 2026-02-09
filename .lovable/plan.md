
# Piano: Fix Doppio Quiz per "Il Punto"

## Problema Identificato

Quando l'utente supera il quiz su un contenuto de "Il Punto" (editoriale):
1. Il quiz viene superato nel `ImmersiveEditorialCarousel`
2. Viene chiamato `onShareComplete(item)` che passa il `focusItem` a `Feed.tsx`
3. In `Feed.tsx` viene costruito manualmente un oggetto `Post` da passare al `ComposerModal`
4. **BUG**: L'oggetto `Post` costruito **non contiene `_gatePassed: true`**
5. Il Composer non sa che il quiz è già stato superato e prova a rifarlo
6. Errore "Impossibile recuperare il test originale. Riprova"

## Soluzione

Aggiungere `_gatePassed: true` all'oggetto `quotedPost` costruito in `Feed.tsx` nel callback `onShareComplete`.

## Modifica Tecnica

**File**: `src/pages/Feed.tsx`
**Linee**: 437-463

```typescript
// PRIMA
onShareComplete={(focusItem) => {
  setQuotedPost({
    id: focusItem.id,
    content: focusItem.summary,
    author_id: 'system',
    // ... altri campi ...
  } as unknown as Post);
  setShowComposer(true);
}}

// DOPO
onShareComplete={(focusItem) => {
  setQuotedPost({
    id: focusItem.id,
    content: focusItem.summary,
    author_id: 'system',
    // ... altri campi ...
    _gatePassed: true,  // <-- AGGIUNGERE QUESTO FLAG
  } as unknown as Post);
  setShowComposer(true);
}}
```

## Perché Funziona

Il `ComposerModal` ha già la logica per bypassare il gate (linee 245-247):

```typescript
if (quotedPost?._gatePassed === true) {
  return { label: 'Quiz già superato', requiresGate: false };
}
```

E nella funzione `handlePublish` (già implementato):

```typescript
if (quotedPost?._gatePassed === true) {
  console.log('[Composer] Gate bypass - quiz already passed in Feed Reader');
  addBreadcrumb('gate_bypass', { reason: '_gatePassed' });
  await publishPost();
  return;
}
```

Basta solo passare il flag dall'origine!

## Test Case

1. Vai su "Il Punto" nel feed
2. Clicca "Condividi" su un editoriale
3. Leggi il contenuto e supera il quiz
4. Il Composer si apre
5. **VERIFICA**: Cliccando "Pubblica" il post viene pubblicato **senza un secondo quiz**
6. Il banner dovrebbe mostrare "Quiz già superato" invece di "Gate attivo"
