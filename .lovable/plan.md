
# Implementazione NavBar con FAB Centrale

## Piano Confermato - Pronto per Implementazione

Il piano è stato approvato con le seguenti specifiche aggiuntive:

### Dettagli Tecnici Finali

**1. Ombra FAB Centrale (morbida per profondità)**
```css
.liquid-glass-fab-central {
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.35),    /* Ombra principale morbida */
    0 4px 16px rgba(0, 0, 0, 0.25),    /* Ombra secondaria */
    0 2px 8px rgba(135, 206, 250, 0.15), /* Glow azzurro sottile */
    inset 0 1px 3px rgba(255, 255, 255, 0.2);
}
```

**2. Timing Reattivo (Composer a 300ms)**
```typescript
const handleFabClick = useCallback(() => {
  haptics.medium();
  setShowRipple(true);
  
  // Apertura composer a 300ms (prima che ripple finisca a 500ms)
  setTimeout(() => {
    onComposerClick?.();
  }, 300);
  
  // Ripple completa a 500ms
  setTimeout(() => {
    setShowRipple(false);
  }, 500);
}, [onComposerClick]);
```

### File da Modificare

1. **`src/components/navigation/BottomNavigation.tsx`**
   - Riorganizzazione layout a 5 slot
   - Rimozione tab "Saved"
   - Aggiunta FAB centrale con stato ripple
   - Nuova prop `onComposerClick`

2. **`src/index.css`**
   - Nuova classe `.liquid-glass-fab-central` con ombra morbida
   - Animazione `@keyframes liquid-ripple`
   - Classe `.fab-liquid-ripple`

3. **`src/pages/Feed.tsx`**
   - Rimozione `<FloatingActionButton />`
   - Passaggio `onComposerClick={handleCreatePost}` a `<BottomNavigation />`

4. **`src/pages/Profile.tsx`**
   - Aggiunta icona Bookmark nel header (a sinistra di Settings)
   - Navigazione a `/saved` al click

5. **Altre pagine con BottomNavigation**
   - Search.tsx, Messages.tsx, Saved.tsx: aggiornamento props
