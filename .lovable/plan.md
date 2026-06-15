## Quick win: rimuovere console spam che blocca il main thread

### File 1: src/hooks/useDynamicCardLayout.ts
- Rimuovere TUTTI i blocchi `if (isDev) { console.log(...) / console.group(...) / console.groupEnd() }` interni all'algoritmo di layout (Fase A, B, D, D.1, D.2, stato finale, computeLayout POST measurement).
- Mantenere i `console.warn` (sono utili in DEV per ref mancanti e config errata).
- Non rimuovere commenti esplicativi.

### File 2: src/components/feed/ImmersiveFeedContainer.tsx
- Rimuovere l'intero `useEffect` con `setInterval` che logga `[DEBUG SCROLL]` ogni 5 secondi (riga ~174).

### Verifica
- `tsc --noEmit` clean.
- `npm run build` clean.
- `grep -n "console.log\|console.info" src/hooks/useDynamicCardLayout.ts` → 0 risultati.

### Commit
- Messaggio: `perf(feed): remove console spam from dynamic layout and feed container`