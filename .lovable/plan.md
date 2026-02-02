
# Unificazione Navigazione Commenti - Il Punto

## Analisi del Problema

Ho analizzato il codice e identificato le seguenti criticità:

### 1. Logica Commenti Duplicata
**FocusDetailSheet.tsx** (linee 389-481) ha una gestione dei commenti **completamente inline**:
- Espande una sezione commenti direttamente nello Sheet
- Il click sull'icona MessageCircle fa `setCommentsExpanded(!commentsExpanded)` → mostra una sezione inline
- Quando l'utente sceglie "Dopo aver letto", chiama `handleReadAndComment()` che genera **immediatamente** il quiz

**Feed.tsx** (linee 433-436 e 549-582) usa un pattern diverso:
- Il click su `onComment` nell'ImmersiveEditorialCarousel apre il `CommentsDrawer` esterno
- Il Gate viene richiesto **solo quando l'utente cerca di scrivere** dentro il drawer

### 2. Regressione Identificata
Il problema è che nel FocusDetailSheet il Gate scatta **prematuramente** quando l'utente vuole solo vedere i commenti, perché la logica di scelta tipo commento è integrata nella visualizzazione stessa.

### 3. Counter non sincronizzato
L'invalidazione in `useFocusComments` è corretta (`['daily-focus']` matcha parzialmente `['daily-focus', refreshNonce]`), ma il FocusDetailSheet legge i commenti dalla sua query locale, non dalla reazione.

---

## Soluzione Proposta

### Approccio: Rimuovere la logica commenti inline dal FocusDetailSheet e usare il CommentsDrawer

#### 1. Modifica FocusDetailSheet.tsx
**Rimuovere**:
- Stato `commentsExpanded` e la sezione commenti inline (linee 389-481)
- Gli hook `useFocusComments`, `useAddFocusComment`, `useDeleteFocusComment` (già usati dal drawer)
- Il componente interno `CommentWithReplies` (non necessario, il drawer usa `CommentItem`)
- Lo stato `showCommentForm`, `commentMode`, `userPassedGate` ecc.

**Aggiungere**:
- Una nuova prop `onComment?: () => void` 
- Il click sull'icona MessageCircle chiama `onComment?.()` invece di espandere la sezione

#### 2. Modifica Feed.tsx
- Passare la prop `onComment` al `FocusDetailSheet`
- Quando viene chiamata, aprire il `CommentsDrawer` (riutilizza la stessa logica già usata per il carousel)

#### 3. Gestione Drawer Sovrapposti
Il CommentsDrawer verrà aperto sopra il FocusDetailSheet. Il sistema Vaul (drawer su drawer) che usiamo già è stabile.

---

## Dettagli Tecnici

### File: `src/components/feed/FocusDetailSheet.tsx`

**Props da aggiungere:**
```typescript
interface FocusDetailSheetProps {
  // ... props esistenti ...
  onComment?: () => void; // NUOVA: callback per aprire drawer commenti
}
```

**Sezione da modificare (linee 352-366):**
Il pulsante MessageCircle attuale:
```typescript
<button 
  onClick={(e) => {
    e.stopPropagation();
    setCommentsExpanded(!commentsExpanded); // RIMOSSO
  }}
  ...
>
```

Diventa:
```typescript
<button 
  onClick={(e) => {
    e.stopPropagation();
    onComment?.(); // NUOVO: delega al parent
  }}
  className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
>
  <MessageCircle className="w-5 h-5 text-white" />
  <span className="text-xs font-bold text-white">{reactions.comments || 0}</span>
</button>
```

**Sezioni da rimuovere:**
- Linee 7, 84-86: imports e hook `useFocusComments`
- Linee 73-82, 145-223: stati e handler legati ai commenti inline
- Linee 389-481: sezione `{commentsExpanded && ...}`
- Linee 564-711: componente `CommentWithReplies` (non più necessario)

### File: `src/pages/Feed.tsx`

**Modifica al FocusDetailSheet (linee 520-546):**
```typescript
<FocusDetailSheet
  // ... props esistenti ...
  onComment={() => {
    // Apri CommentsDrawer per questo focus
    setSelectedFocusForComments({ type: 'daily', data: selectedFocus.data });
    setFocusCommentsOpen(true);
  }}
/>
```

Il CommentsDrawer esistente (linee 549-582) gestirà automaticamente i commenti per il focus, incluso il Gate solo quando l'utente tenta di scrivere.

### File: `src/hooks/useFocusComments.ts`

Verifica che l'invalidazione nel `onSettled` sia robusta. Attualmente usa `onSuccess` - per garantire sincronizzazione anche in caso di errori UI, aggiungere invalidazione:
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
  queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
}
```

---

## Risultato Atteso

1. Il click sull'icona commenti nel FocusDetailSheet apre il CommentsDrawer
2. L'utente può **leggere** i commenti senza dover fare alcun quiz
3. Il Gate scatta **solo** quando l'utente interagisce con il composer nel drawer per scrivere
4. Il counter si aggiorna immediatamente dopo l'invio di un commento
5. Nessuna regressione sulle reazioni emoji appena sistemate

---

## Vincoli Rispettati

- Nessun nuovo componente creato
- Logica `commentKind` in `CommentItem` preservata
- Sistema reazioni emoji non toccato
- Gate non modificato, solo spostato il momento dell'invocazione
