## Diagnosi

Verificato in codice:

- `src/components/feed/ImmersiveEditorialCarousel.tsx:235` disegna un layer di sfondo inset:
  ```tsx
  <div className="absolute inset-0 z-0" style={{ background: '#0A1420' }} />
  ```
- Il box interno (righe 571-585) è già trasparente (nessun `background`, nessun `border`, nessuna `boxShadow`), quindi non è lui la causa dello stacco.
- `CardShell` e le sue zone (`src/index.css:2198-2262`) non hanno alcun `background` proprio.
- Il token `--background` del tema dark è `hsl(220 25% 5%)` ≈ **#0A0D12** (grigio-neutro leggermente più freddo).
- Il layer del carosello dipinge invece **#0A1420** (lo stesso "blu notte" del vecchio box). Questi due colori sono vicini ma NON identici: #0A1420 è più saturato/blu, `--background` è più neutro. Da qui il "quadrato" percettibile: non è il box, è il fondo del componente che continua a coprire la card sottostante con una tinta diversa dall'app.

Il feed sotto (`ImmersiveFeedContainer` → wrapper `w-full bg-background`) mostra `hsl(var(--background))`. Non appena si entra nello slot di Il Punto, il layer `#0A1420` sovrascrive quel colore → stacco visibile.

## Fix proposto (1 sola modifica, chirurgica)

File: `src/components/feed/ImmersiveEditorialCarousel.tsx`

Riga 235 — rendere il layer trasparente così che il fondo dell'app (`bg-background`) traspaia edge-to-edge:

```diff
- <div className="absolute inset-0 z-0" style={{ background: '#0A1420' }} />
+ <div className="absolute inset-0 z-0" style={{ background: 'transparent' }} />
```

Alternativa equivalente (più pulita): rimuovere del tutto il `<div>` di background, dato che diventa inerte.

## Cosa NON tocco

- Il box flottante (già transparent/no-border/no-shadow dallo step di diagnosi precedente).
- `CardShell` e le zone (`.card-shell`, `.zone-*`).
- Il Content Layer, il Carousel, la slide, le action icon, la larghezza/raggio.
- `ImmersiveFeedContainer`, `ImmersivePostCard`, tokens globali.

## Verifica attesa

- Lo slot di Il Punto assume esattamente lo stesso colore delle card feed circostanti (nessuna variazione di tinta al confine).
- Titolo, badge "✦ AI Synthesis", avatar Il Punto, action rail: tutti invariati (sono sopra a `z-10`, non toccano il layer rimosso).
- `tsc --noEmit` verde.

## Se dopo la modifica lo stacco persiste

Significherebbe che a monte c'è un altro layer (es. wrapper della slide `ImmersiveFeedContainer` o `CardShell` con `background-color` ereditato in dark). In quel caso, come step 2 di diagnosi, ispezionerei via Playwright/DevTools i `background-color` computati sulla catena DOM del componente attivo. Ma la causa più probabile — e coerente col codice — è il layer alla riga 235.
