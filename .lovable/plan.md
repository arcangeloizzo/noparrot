
# Piano: Completamento Light Mode - Adattamento Componenti

## Problema identificato

Dagli screenshot emerge che molti componenti hanno colori **hardcoded** che ignorano le variabili CSS del tema:

1. **Header** - Icona notifiche `text-white` fissa
2. **Bottom Navigation** - `text-white`, `text-gray-400` hardcoded
3. **Profile** - Pill metriche, bottoni con `bg-[#141A1E]`
4. **ProfileSettingsSheet** - Background `bg-[#0E1419]`, card items `bg-[#141A1E]`
5. **ComposerModal** - Background `bg-zinc-950`, bordi `border-zinc-800`
6. **Nebula/CompactNebula** - Background `bg-[#0A0F14]`
7. **DiaryFilters** - Filtri con `bg-[#1A2127]`
8. **DiaryEntry** - Card con `bg-[#141A1E]`
9. **FocusDetailSheet** - Background `bg-[#0E141A]`, testi `text-white`
10. **LogoHorizontal** - "PARROT" con `fill-white` fisso
11. **ImmersivePostCard/ImmersiveEditorialCarousel** - Gradienti e overlay dark hardcoded

## Strategia di risoluzione

### Mappatura colori hardcoded → variabili CSS

| Hardcoded | Variabile CSS corretta |
|-----------|------------------------|
| `bg-[#0E141A]`, `bg-[#0E1419]` | `bg-background` |
| `bg-[#141A1E]`, `bg-[#1A2127]` | `bg-secondary` o `bg-card` |
| `bg-zinc-950`, `bg-zinc-900` | `bg-background` o `bg-card` |
| `text-white` (in UI persistente) | `text-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `border-white/10` | `border-border` |
| `border-zinc-800` | `border-border` |
| `hover:bg-white/10` | `hover:bg-muted/50` |

### Componenti immersivi (Feed, Editorial)

Per ImmersivePostCard e ImmersiveEditorialCarousel, i gradienti dark sono **intenzionali** per garantire leggibilità del testo bianco su immagini. Questi componenti restano invariati perchè:
- Sono "full-screen cinematic" cards con overlays su immagini
- Il testo deve essere bianco per contrasto con qualsiasi immagine
- Il fade nero garantisce transizioni fluide tra card

## File da modificare

### 1. Header.tsx
- `text-white` → `text-foreground`
- `hover:bg-white/10` → `hover:bg-muted/50`

### 2. BottomNavigation.tsx
- `text-white` → `text-foreground`
- `text-gray-400` → `text-muted-foreground`
- `ring-white` → `ring-foreground`
- `ring-white/20` → `ring-border`

### 3. Profile.tsx
- `bg-[#141A1E]` → `bg-secondary`
- `border-white/10` → `border-border`
- `hover:border-white/20` → `hover:border-border/50`

### 4. ProfileSettingsSheet.tsx
- `bg-[#0E1419]` → `bg-background`
- `border-white/10` → `border-border`
- `bg-[#141A1E]` → `bg-card`
- `hover:bg-[#1A2127]` → `hover:bg-muted`
- `hover:bg-white/10` → `hover:bg-muted/50`

### 5. ComposerModal.tsx
- `bg-zinc-950` → `bg-background`
- `bg-zinc-900` → `bg-card`
- `border-zinc-800` → `border-border`
- `bg-zinc-800` (avatar fallback) → `bg-muted`
- `text-zinc-400` → `text-muted-foreground`

### 6. CompactNebula.tsx
- `bg-[#0A0F14]` → `bg-card`
- `border-white/[0.08]` → `border-border`
- `hover:border-white/15` → `hover:border-border/50`
- `bg-[#0A0F14]/80` (empty state) → `bg-card/80`

### 7. DiaryFilters.tsx
- `bg-[#1A2127]` → `bg-secondary`
- `hover:bg-[#242B33]` → `hover:bg-muted`

### 8. DiaryEntry.tsx
- `bg-[#141A1E]` → `bg-card`
- `hover:bg-[#1A2127]` → `hover:bg-muted`

### 9. FocusDetailSheet.tsx
- `bg-[#0E141A]` → `bg-background`
- `border-white/10` → `border-border`
- `text-white` → `text-foreground`
- `text-white/70` → `text-muted-foreground`
- `text-gray-400` → `text-muted-foreground`
- `text-gray-200` → `text-foreground`
- `hover:bg-white/10` → `hover:bg-muted/50`

### 10. LogoHorizontal.tsx
- `fill-white` → `fill-foreground` (con CSS class per supporto tema)
- Aggiungere classe `text-foreground` e usare `fill-current` per SVG text paths

### 11. index.css (Light Mode specifico)
Aggiungere regole per componenti specifici in `.light`:
```css
.light .liquid-glass-fab-central {
  background: linear-gradient(135deg, #0A7AFF, #0d6efd);
  box-shadow: 0 4px 15px rgba(10, 122, 255, 0.3);
}
```

## Componenti da NON modificare

I seguenti componenti mantengono gradienti dark perche sono "immersive" con contenuto sopra immagini:
- `ImmersivePostCard.tsx` - Le card del feed sono volutamente cinematiche
- `ImmersiveEditorialCarousel.tsx` - Il carousel "Il Punto" mantiene lo stile dark
- `SpotifyGradientBackground.tsx` - Gradiente specifico per Spotify

## Flusso delle modifiche

```text
1. Header + BottomNavigation (navigazione)
   |
2. Profile + ProfileSettingsSheet (profilo)
   |
3. ComposerModal (creazione contenuto)
   |
4. CompactNebula + DiaryFilters + DiaryEntry (componenti profilo)
   |
5. FocusDetailSheet (dettaglio editoriale)
   |
6. LogoHorizontal (branding)
   |
7. index.css (regole light specifiche)
```

## Test di validazione

1. Aprire l'app in Dark Mode → verificare che sia identica a prima
2. Passare a Light Mode tramite /settings/privacy
3. Verificare:
   - Header: icona notifiche visibile (non bianca su bianco)
   - Bottom Nav: icone e testi visibili
   - Profile: pill metriche leggibili, Nebula con sfondo chiaro
   - Settings sheet: sfondo chiaro, card items visibili
   - Composer: sfondo chiaro, placeholder visibile
   - Focus detail: titolo e testo visibili
   - Logo nella header: "PARROT" visibile in entrambi i temi

## Note tecniche

### Gestione SVG fill
Per `LogoHorizontal.tsx`, il testo "PARROT" usa `fill-white`. Per supportare entrambi i temi:

```tsx
// Prima
<path className="fill-white" d="..."/>

// Dopo
<path className="fill-foreground" d="..."/>
```

Dove `fill-foreground` è definito in CSS come:
```css
.fill-foreground {
  fill: hsl(var(--foreground));
}
```

### Filtri attivi
I DiaryFilters usano `bg-white text-black` per lo stato attivo. Questo va invertito in light mode:
```css
.light .filter-active {
  @apply bg-foreground text-background;
}
```

Oppure usare `bg-primary text-primary-foreground` per consistenza.
