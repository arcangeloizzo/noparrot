## Obiettivo
Ripristinare il "guscio card" (bordo + sfondo card + ombra) attorno al contenuto di Il Punto, uguale alle altre card del feed, mantenendo il fondo esterno trasparente (che ora eredita correttamente `bg-background`).

## Diagnosi
In `src/components/feed/ImmersiveEditorialCarousel.tsx`, il `boxRef` (righe ~571-586) è stato azzerato durante la diagnostica precedente:
```
border: 'none',
background: 'transparent',
boxShadow: 'none',
```
Questo è il motivo per cui Il Punto ora non ha più il contorno card. Il fondo esterno (riga 235) è già `transparent` e va lasciato così.

## Modifica (1 file, 3 righe)
`src/components/feed/ImmersiveEditorialCarousel.tsx`, dentro `style` del `boxRef`:

- `border: 'none'` → `border: '1px solid rgba(255,255,255,0.08)'`
- `background: 'transparent'` → `background: 'hsl(var(--card))'` (usa il token card come le altre card del feed)
- `boxShadow: 'none'` → `boxShadow: '0 8px 24px -12px rgba(0,0,0,0.5)'`

Non tocco: il layer di sfondo esterno (resta `transparent`), `CardShell`, Content Layer, Carousel, slide, action icon, `margin/width/borderRadius/overflow/scrollSnapAlign/scrollMargin`.

## Verifica
- Build `tsc --noEmit` verde
- Visivamente: card Il Punto con contorno percepibile su fondo navy, coerente con le altre card immersive
