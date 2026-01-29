
# Piano: Correzione Colori SVG e Animazione Splash Screen

## Panoramica

Questo piano corregge l'inversione dei colori del testo nei loghi SVG e migliora l'animazione della Splash Screen separando l'icona dal testo per un controllo più preciso.

---

## 1. Correzione Colori SVG

### LogoVertical.tsx e LogoHorizontal.tsx

| Elemento | Stato Attuale | Nuovo Stato |
|----------|---------------|-------------|
| Scritta "NO" | `className="fill-white"` | `fill="#2465d2"` (blu originale) |
| Scritta "PARROT" | `fill="#393e46"` (grigio) | `className="fill-white"` |
| Icona pappagallo | Colori originali | Invariato |

**Modifiche nei file:**
- Rimuovere `className="fill-white"` dai path di "N" e "O"
- Aggiungere `fill="#2465d2"` ai path di "N" e "O"
- Rimuovere `fill="#393e46"` dai path di "PARROT"
- Aggiungere `className="fill-white"` ai path di "PARROT"

---

## 2. Prop `hideText` per LogoVertical

### Modifiche all'interfaccia

```text
interface LogoVerticalProps {
  className?: string;
  hideText?: boolean;  // <- Nuova prop opzionale
}
```

### Logica di rendering

- Se `hideText={true}`: renderizza solo il gruppo `<g>` con l'icona del pappagallo
- Se `hideText={false}` o non specificato: renderizza tutto (icona + testo)

### Considerazioni tecniche

Il viewBox del logo verticale è `0 0 1024 1024`, ma l'icona occupa solo la parte superiore. 
Quando `hideText={true}`, potrebbe essere utile modificare il viewBox per centrare l'icona, oppure lasciarlo invariato e gestire il dimensionamento esternamente con `className`.

**Approccio scelto**: Lasciare il viewBox invariato per semplicità. L'icona si posizionerà nella parte superiore del contenitore SVG.

---

## 3. Aggiornamento SplashScreen

### Struttura attuale (problematica)

```text
<LogoVertical className="w-48 h-auto" />  // Include testo con colori errati
<span>NO</span><span>PARROT</span>          // Testo duplicato
```

### Nuova struttura

```text
<LogoVertical hideText={true} className="w-32 h-32" />  // Solo icona

<h1 className="text-3xl font-bold tracking-wider">
  <span className="text-[#2465d2]">NO</span>
  <span className="text-white">PARROT</span>
</h1>
```

### Animazione preservata

L'animazione esistente viene mantenuta:
- **Phase 0**: Icona appare con fade-in
- **Phase 1**: L'icona si ridimensiona e sale, il testo appare sotto con fade-in
- **Phase 2**: Tutto sfuma e si passa alla schermata successiva

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/ui/LogoVertical.tsx` | Aggiungere prop `hideText`, invertire colori NO/PARROT |
| `src/components/ui/LogoHorizontal.tsx` | Invertire colori NO/PARROT |
| `src/components/onboarding/SplashScreen.tsx` | Usare `hideText={true}`, aggiungere h1 con colori corretti |

---

## Riepilogo Colori Brand

| Elemento | Colore | Uso |
|----------|--------|-----|
| "NO" | `#2465d2` | Blu corporate, su qualsiasi sfondo |
| "PARROT" | `white` / `#FFFFFF` | Bianco, visibile su sfondo scuro |
| Icona | Gradients originali | Mantiene i colori del brand |
