
# Piano: Aggiunta supporto Light Mode

## Obiettivo
Implementare un sistema di temi con tre opzioni (Dark default, Light, System) mantenendo l'interfaccia dark attuale esattamente come reference.

## Analisi attuale

### Stato del progetto
- **Tailwind config**: `darkMode: ["class"]` - già configurato per class-based theming
- **next-themes**: Già installato (^0.3.0) ma non utilizzato
- **CSS Variables**: Definite in `:root` ma non separate correttamente per dark/light
- **Problema attuale**: Il tema dark è mischiato tra `:root` e `.dark`, causando incoerenze

### Colori attuali (Dark - da preservare)
```css
--background: 220 25% 5%           /* #0E141A quasi nero */
--foreground: 0 0% 98%             /* bianco caldo */
--card: 210 18% 12%                /* grigio scuro */
--border: 210 18% 18%              /* bordi grigi */
--muted-foreground: 210 10% 55%   /* testo secondario */
--primary: 206 100% 50%            /* blu NoParrot #0A7AFF */
```

## Architettura della soluzione

### 1. Ristrutturazione CSS Variables

**`:root` (base)** - Variabili condivise tra temi:
- Primary blue, brand colors (invarianti)
- Spacing, radius, typography
- Transition timings

**`:root` (default = dark)** - Tema dark di default:
- Background scuri
- Foreground chiari
- Glass effects con rgba bianco

**`.light`** - Tema light speculare:
- Background: `#F8FAFC` (slate-50)
- Foreground: `#1E293B` (slate-800 antracite)
- Glass effects con rgba nero
- Stessi colori accent (blu NoParrot)

### 2. Palette Light Mode proposta

```css
.light {
  --background: 210 40% 98%;           /* #F8FAFC slate-50 */
  --background-secondary: 214 32% 95%; /* #F1F5F9 slate-100 */
  --foreground: 222 47% 11%;           /* #1E293B slate-800 antracite */
  --foreground-muted: 215 16% 47%;     /* #64748B slate-500 */
  
  --card: 0 0% 100%;                   /* bianco puro */
  --card-foreground: 222 47% 11%;      /* slate-800 */
  
  --border: 214 32% 91%;               /* #E2E8F0 slate-200 */
  --input: 214 32% 91%;
  
  /* Primary resta invariato */
  --primary: 206 100% 50%;             /* #0A7AFF */
  --primary-foreground: 0 0% 100%;
  
  /* Glass per light mode */
  --glass-primary: rgba(0, 0, 0, 0.04);
  --glass-border: rgba(0, 0, 0, 0.08);
  
  /* Trust badges con contrasto adeguato */
  --trust-high: 142 71% 35%;
  --trust-medium: 38 92% 45%;
  --trust-low: 0 72% 50%;
}
```

### 3. Integrazione ThemeProvider (next-themes)

Modifiche a `src/App.tsx`:
```tsx
import { ThemeProvider } from "next-themes";

const App = () => (
  <AppErrorBoundary>
    <ThemeProvider 
      attribute="class" 
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        ...
      </QueryClientProvider>
    </ThemeProvider>
  </AppErrorBoundary>
);
```

### 4. Componente ThemeSwitcher

Nuovo file `src/components/ui/theme-switcher.tsx`:
- Toggle con icone Sun/Moon/Monitor
- Tre stati: dark, light, system
- Haptic feedback su cambio
- Design coerente con action buttons esistenti

### 5. Integrazione nel profilo

Modifiche a `src/pages/SettingsPrivacy.tsx`:
- Nuova sezione "Aspetto" dopo "Profilo cognitivo"
- Radio group con opzioni: Scuro, Chiaro, Sistema
- Preview visivo del tema selezionato

## File da modificare/creare

| File | Azione | Descrizione |
|------|--------|-------------|
| `src/index.css` | Modifica | Ristrutturare variabili: `:root` base, `:root`/`html.dark` dark, `.light` light |
| `src/App.tsx` | Modifica | Wrap con ThemeProvider di next-themes |
| `index.html` | Modifica | Aggiungere `class="dark"` a `<html>` per evitare flash |
| `src/components/ui/theme-switcher.tsx` | Nuovo | Componente switch tema con icone |
| `src/pages/SettingsPrivacy.tsx` | Modifica | Aggiungere sezione "Aspetto" con selettore tema |

## Dettagli implementativi

### CSS: Struttura variabili

```css
@layer base {
  :root {
    /* ===== INVARIANT BRAND TOKENS ===== */
    --primary-blue: 206 100% 50%;
    --noparrot-blue: 211 100% 52%;
    /* ... altri colori brand fissi ... */
    
    /* ===== SPACING, RADIUS, TYPOGRAPHY ===== */
    --space-1: 4px;
    --radius-sm: 10px;
    --font-inter: 'Inter', ...;
    
    /* ===== DEFAULT DARK THEME ===== */
    --background: 220 25% 5%;
    --foreground: 0 0% 98%;
    --card: 210 18% 12%;
    /* ... resto dark ... */
    
    /* Glass Dark */
    --glass-primary: rgba(255, 255, 255, 0.08);
    --glass-border: rgba(255, 255, 255, 0.15);
  }
  
  /* Explicit dark class (mirrors :root for specificity) */
  .dark {
    --background: 220 25% 5%;
    --foreground: 0 0% 98%;
    /* ... identico a :root dark ... */
  }
  
  /* Light theme override */
  .light {
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --border: 214 32% 91%;
    /* ... glass light ... */
    --glass-primary: rgba(0, 0, 0, 0.04);
    --glass-border: rgba(0, 0, 0, 0.08);
  }
}
```

### Body background per Light Mode

```css
html.light body {
  background: 
    radial-gradient(ellipse at 20% 30%, rgba(10, 122, 255, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(10, 122, 255, 0.03) 0%, transparent 50%),
    hsl(210 40% 98%);
  color: hsl(222 47% 11%);
}
```

### Navbar glassmorphism Light

```css
.light .liquid-glass-navbar {
  background: rgba(248, 250, 252, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}
```

### ThemeSwitcher component

```tsx
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  
  const options = [
    { value: 'dark', icon: Moon, label: 'Scuro' },
    { value: 'light', icon: Sun, label: 'Chiaro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];
  
  const handleChange = (value: string) => {
    haptics.light();
    setTheme(value);
  };
  
  return (
    <div className="flex gap-2">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
            theme === value 
              ? "bg-primary/10 border-primary text-primary" 
              : "bg-muted/30 border-border text-muted-foreground"
          )}
        >
          <Icon className="w-5 h-5" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
```

### Integrazione in SettingsPrivacy

```tsx
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { Palette } from "lucide-react";

// Nuova Card dopo "Profilo cognitivo"
<Card className="p-4">
  <div className="flex items-center gap-3 mb-3">
    <Palette className="w-5 h-5 text-indigo-400" />
    <h2 className="text-lg font-semibold">Aspetto</h2>
  </div>
  <p className="text-sm text-muted-foreground mb-4">
    Scegli il tema dell'app. "Sistema" seguirà le impostazioni del tuo dispositivo.
  </p>
  <ThemeSwitcher />
</Card>
```

## Gestione componenti con colori hardcoded

Alcuni componenti usano colori hardcoded (es. `bg-[#0E1419]`). Questi andranno aggiornati per usare variabili CSS:

| Componente | Pattern attuale | Pattern corretto |
|------------|-----------------|------------------|
| ProfileSettingsSheet | `bg-[#0E1419]` | `bg-card` |
| BottomNavigation | `text-gray-400` | `text-muted-foreground` |
| Various | `bg-[#141A1E]` | `bg-secondary` |

## Test di validazione

1. **Dark default**: App si apre in dark mode senza flash
2. **Light mode**: Passare a light, verificare sfondo chiaro e testi scuri
3. **System**: Cambiare preferenza OS, verificare che il tema cambi
4. **Persistenza**: Ricaricare pagina, verificare che il tema sia mantenuto
5. **Glass effects**: Verificare backdrop-blur funzioni in entrambi i temi
6. **Trust badges**: Verificare contrasto adeguato in light mode
7. **Componenti critici**: Feed, Commenti, Il Punto, Profilo

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Flash of wrong theme | `class="dark"` su html + suppressHydrationWarning |
| Colori hardcoded | Audit e sostituzione con variabili |
| Contrasto insufficiente | Test WCAG AA su tutti i colori light |
| Glass illeggibile | Glass opacity ridotta in light mode |

## Timeline stimata

1. **CSS restructure**: 40%
2. **ThemeProvider integration**: 10%
3. **ThemeSwitcher component**: 15%
4. **Settings integration**: 10%
5. **Hardcoded colors cleanup**: 20%
6. **Testing & refinement**: 5%
