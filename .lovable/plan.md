

# Finalizzazione UI - Action Bar Il Punto + NavBar Height

## Riepilogo

Questo intervento è esclusivamente UI. Nessuna modifica alla logica di Comprehension Gate, commenti consapevoli, Trust Score, PULSE o backend.

---

## 1. Allineamento Action Bar - ImmersiveEditorialCarousel

**File:** `src/components/feed/ImmersiveEditorialCarousel.tsx`

### Modifiche linee 556-629:
- Pulsante "Condividi": da `h-10` a `h-11`, con `font-semibold` (come gli altri post)
- Icone (Heart, MessageCircle, Bookmark): da `w-5 h-5` a `w-6 h-6`
- Layout: da `justify-between gap-3` a `gap-6` senza justify-between
- Rimosso container `bg-black/20 h-10 px-3 rounded-2xl border` dalle reactions
- Font contatori: da `text-xs` a `text-sm`

### Modifica linea 229:
- Padding bottom: da `pb-24` a `pb-28` per compensare navbar più alta

---

## 2. Aumento Altezza NavBar + Sporgenza FAB

**File:** `src/components/navigation/BottomNavigation.tsx`

### Modifiche linee 117-119:
- Altezza container: da `h-14` (56px) a `h-16` (64px)
- Aggiunta classe `pb-safe` alla nav per iOS safe area

### Modifiche linee 147-160:
- Sporgenza FAB: da `-translate-y-3` a `-translate-y-4` per mantenere l'aspetto iconico con la navbar più alta

---

## 3. CSS Safe Area Support

**File:** `src/index.css`

### Modifiche linee 607-613:
- Aggiunto `padding-bottom: env(safe-area-inset-bottom, 0px)` alla classe `.liquid-glass-navbar`
- Aggiunta nuova classe utility `.pb-safe`

---

## Dettagli Tecnici

### Dimensioni Confronto

| Elemento | Prima | Dopo |
|----------|-------|------|
| Navbar height | h-14 (56px) | h-16 (64px) + safe-area |
| FAB sporgenza | -translate-y-3 | -translate-y-4 |
| Share button | h-10 | h-11 |
| Icone reazioni | w-5 h-5 | w-6 h-6 |
| Gap action bar | gap-3 | gap-6 |
| Content padding-bottom | pb-24 | pb-28 |
| Font contatori | text-xs | text-sm |

### Font "Condividi" - Coerenza

Il pulsante "Condividi" usa `text-sm font-semibold` sia in ImmersivePostCard che in ImmersiveEditorialCarousel per coerenza assoluta tra i due tipi di contenuto.

---

## Vincoli Rispettati

- Nessuna modifica alla logica Comprehension Gate
- Nessuna modifica ai commenti consapevoli  
- Nessuna modifica al Trust Score/PULSE
- Nessuna modifica al backend
- Posizionamento fixed della navbar non toccato

---

## Test Post-Implementazione

1. Verificare su iPhone che la navbar non si sovrapponga alla home indicator bar
2. Verificare che il FAB sporga in modo iconico sopra la navbar più alta
3. Verificare che le icone e il pulsante Condividi abbiano le stesse dimensioni su Post e Il Punto
4. Testare il contenuto scrollabile per assicurarsi che non sia nascosto dalla navbar

