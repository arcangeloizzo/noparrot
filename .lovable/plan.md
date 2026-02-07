
# Piano: Rimuovere l'icona duplicata dalla Zona 1 della card

## Problema Identificato

Nello screenshot si vede un'icona del pappagallo tra l'header fisso (NOPARROT + notifiche) e il profilo autore. Questa icona è un duplicato non necessario.

### Struttura Attuale (Errata)

```text
┌─────────────────────────────────────┐
│  NOPARROT   🔔 ← Header FISSO (h-14)│  (Header.tsx - fixed z-50)
├─────────────────────────────────────┤
│         🦜 ← ICONA DUPLICATA        │  (dentro ImmersivePostCard, riga 1231-1232)
├─────────────────────────────────────┤
│  👤 Arcangelo Izzo    TRUST MEDIO   │  (Profilo autore)
│  un giorno fa                       │
└─────────────────────────────────────┘
```

### Struttura Corretta (Target)

```text
┌─────────────────────────────────────┐
│  NOPARROT   🔔 ← Header FISSO (h-14)│  (Header.tsx - fixed z-50)
├─────────────────────────────────────┤
│         (spazio vuoto h-14)         │  (padding per non finire sotto l'header)
├─────────────────────────────────────┤
│  👤 Arcangelo Izzo    TRUST MEDIO   │  (Profilo autore)
│  un giorno fa                       │
└─────────────────────────────────────┘
```

L'header con Logo + Notifiche è gia presente e fisso (definito in `Header.tsx` con `fixed top-0`). Dentro la card serve solo uno **spazio vuoto** per evitare la sovrapposizione.

## Modifica Richiesta

### File: src/components/feed/ImmersivePostCard.tsx

**Righe 1229-1239** - Sostituire il blocco con l'icona con un semplice spacer:

**Da (attuale):**
```tsx
{/* ZONE 1: Header (App Header + Author Profile) */}
<div className="pt-[env(safe-area-inset-top)] flex flex-col gap-2">
  {/* App Header Row: Logo centered */}
  <div className="flex items-center justify-center h-10">
    <Logo variant="icon" size="sm" className="h-6 w-6" />
  </div>
  
  {/* Author Profile Row */}
  <div className="flex justify-between items-start">
    ...
```

**A (corretto):**
```tsx
{/* ZONE 1: Header Spacer + Author Profile */}
<div className="pt-[env(safe-area-inset-top)] flex flex-col gap-2">
  {/* Spacer for fixed app header (Logo + Notifications) - no content, just height */}
  <div className="h-14" aria-hidden="true" />
  
  {/* Author Profile Row */}
  <div className="flex justify-between items-start">
    ...
```

### Dettagli Tecnici

1. **Rimuovere** il componente `<Logo>` dalla Zona 1 (riga 1232)
2. **Mantenere** lo spacer con `h-14` (56px = altezza dell'header fisso)
3. **Mantenere** `pt-[env(safe-area-inset-top)]` per la safe area del notch
4. **Aggiungere** `aria-hidden="true"` per accessibilita (e un commento esplicativo)

### Risultato Atteso

- Il profilo autore sara immediatamente sotto lo spazio riservato all'header fisso
- Nessuna icona duplicata visibile
- Layout stabile e deterministico

## File Coinvolti

| File | Azione |
|------|--------|
| `src/components/feed/ImmersivePostCard.tsx` | Sostituire Logo con spacer vuoto (righe 1231-1233) |

## Verifica

Dopo la modifica, nello screenshot:
- NOPARROT + icona notifiche visibili in alto (header fisso)
- Spazio vuoto sotto l'header
- Profilo autore (avatar + nome + timestamp) immediatamente dopo lo spazio
- Nessuna icona pappagallo duplicata
