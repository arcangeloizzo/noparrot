
# Piano: Conversione Logo SVG con Colori Preservati

## Panoramica

Sostituzione delle immagini PNG del logo con componenti React SVG nativi per garantire migliore qualità e controllo del contrasto in Dark Mode. Il testo "NO" sarà bianco per visibilità su sfondo scuro, mentre l'icona e "PARROT" manterranno i colori originali del brand.

## Analisi File SVG

### Logo Verticale.svg (1024x1024)
- **Struttura**: Icona pappagallo sopra + testo "NOPARROT" sotto
- **Colori testo**:
  - "NO" (linee 120-121): `fill: #2465d2` (classe `.cls-1`)
  - "PARROT" (linee 122-127): `fill: #393e46` (classe `.cls-12`)
- **Icona**: Gradients complessi (mantenerli identici)

### LogoOrizzontale.svg (1024x221)
- **Struttura**: Icona pappagallo a sinistra + testo "NOPARROT" a destra
- **Colori testo**:
  - "NO" (linea 125): `fill: url(#Sfumatura_senza_nome_60-2)` → gradiente blu
  - "PARROT" (linee 127-132): `fill: #393e46` (classe `.cls-13`)
- **Icona**: Gradients complessi (mantenerli identici)

## File da Creare

### 1. `src/components/ui/LogoVertical.tsx`
Componente SVG inline con:
- Tutti i `<defs>` e gradients originali
- Scritta "NO": override con `className="fill-white"` (rimuove `class="cls-1"`)
- Icona + "PARROT": colori originali preservati
- Prop `className` per dimensionamento esterno

### 2. `src/components/ui/LogoHorizontal.tsx`
Componente SVG inline con:
- Tutti i `<defs>` e gradients originali
- Scritta "NO": override con `className="fill-white"` (rimuove `class="cls-2"`)
- Icona + "PARROT": colori originali preservati
- Prop `className` per dimensionamento esterno

## File da Modificare

### 3. `src/components/ui/logo.tsx`
Aggiornare il componente `Logo` per usare i nuovi SVG:
- `variant="icon"` → `<LogoVertical />` (solo icona, crop della parte testuale o logo intero piccolo)
- `variant="extended"` → `<LogoHorizontal />`
- Rimuovere dipendenza da `LOGO_BASE` e `LOGO_EXTENDED` per queste varianti

### 4. `src/components/onboarding/SplashScreen.tsx`
- Sostituire `<Logo variant="icon" />` con `<LogoVertical />` direttamente
- Applicare `className="w-48 h-auto"` per dimensionamento

### 5. `src/components/onboarding/OnboardingSlides.tsx`
- Sostituire `<Logo variant="icon" />` in `SlideNemico` con `<LogoVertical />`
- Applicare `className="w-auto h-32"` per dimensionamento

### 6. `src/components/navigation/Header.tsx`
- Sostituire `<Logo variant="extended" />` con `<LogoHorizontal />`
- Applicare `className="h-7"` per dimensionamento

## Struttura Componenti SVG

```text
┌─────────────────────────────────────────────────────┐
│ LogoVertical.tsx / LogoHorizontal.tsx               │
├─────────────────────────────────────────────────────┤
│ interface Props {                                   │
│   className?: string;                               │
│ }                                                   │
│                                                     │
│ export const LogoVertical = ({ className }) => (    │
│   <svg className={className} viewBox="...">         │
│     <defs>... gradients originali ...</defs>        │
│     <g>... icona con colori originali ...</g>       │
│     <g>                                             │
│       <path className="fill-white" d="...NO..." /> │
│       <path fill="#393e46" d="...PARROT..." />      │
│     </g>                                            │
│   </svg>                                            │
│ );                                                  │
└─────────────────────────────────────────────────────┘
```

## Regole di Colore (Riepilogo)

| Elemento | Colore Originale | Nuovo Colore |
|----------|-----------------|--------------|
| Scritta "NO" | #2465d2 / gradient blu | `fill-white` (Tailwind) |
| Scritta "PARROT" | #393e46 | #393e46 (invariato) |
| Icona pappagallo | Gradients complessi | Invariato |

## Impatto Minimo

I file che usano `LOGO_BASE` per icone piccole (badge "Consapevole" nei commenti) continueranno a funzionare - il PNG rimane disponibile per quei casi d'uso dove un SVG complesso non è necessario.

---

## Dettagli Tecnici

### Conversione SVG → JSX
- Attributi `class` → `className`
- `xmlns:xlink` → `xmlnsXlink`
- `data-name` → `data-name` (invariato, supportato)
- Rimuovere `<?xml version...?>` header
- Rimuovere `id="Livello_3"` o convertire in prop opzionale

### Gestione Gradients
Ogni componente include i propri `<defs>` con ID univoci per evitare conflitti se entrambi i loghi sono sulla stessa pagina. Gli ID saranno prefissati:
- LogoVertical: `logo-v-gradient-*`
- LogoHorizontal: `logo-h-gradient-*`

### Dimensionamento
I componenti usano `viewBox` per scalare proporzionalmente. Il `className` del container controlla le dimensioni effettive via Tailwind (`w-48`, `h-32`, etc.).
