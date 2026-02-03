
# Piano: Fix errore "null is not an object (evaluating 'fe.target')" su iOS Safari

## Problema

L'errore si verifica su **iOS Safari** quando l'utente interagisce con un elemento che usa **Radix UI Tooltip** e il componente viene smontato mentre un pointer event (`onPointerOut`) e ancora in corso.

### Stack trace decodificato
```
source: window.error
message: null is not an object (evaluating 'fe.target')
handler: onPointerOut
device: iPhone Safari iOS 18.7
```

### Root Cause

Il componente `CommentItem.tsx` (linee 246-261) usa un `Tooltip` Radix per mostrare il badge "Ha letto la fonte prima di commentare":

```tsx
<TooltipProvider delayDuration={200}>
  <Tooltip>
    <TooltipTrigger>
      <img src={LOGO_BASE} ... />
    </TooltipTrigger>
    <TooltipContent>...</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Questo tooltip si trova all'interno di commenti che possono essere smontati rapidamente durante:
- Scroll veloce nel feed virtualizzato
- Chiusura del drawer dei commenti
- Navigazione tra post

Quando il puntatore esce (`onPointerOut`) da un elemento che viene smontato, Radix UI tenta di accedere a `event.target` che e gia `null`, causando il crash.

---

## Soluzione proposta

### Approccio: Wrapping difensivo del Tooltip

Creare un componente wrapper `SafeTooltip` che:
1. Usa `React.memo` per evitare re-render inutili
2. Aggiunge un try-catch a livello di event handler per iOS Safari
3. Disabilita il tooltip su dispositivi touch (dove non ha senso mostrare hover tooltips)

Questo approccio e **minimamente invasivo** e non impatta altri componenti.

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/ui/tooltip.tsx` | Aggiungere protezione difensiva contro eventi null |
| `src/components/feed/CommentItem.tsx` | Usare `disableHoverableContent` per iOS |

---

## Dettagli tecnici

### Modifica 1: tooltip.tsx - Protezione per iOS Safari

Aggiungere una prop `disableHoverableContent` e gestione difensiva:

```tsx
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

// Detect iOS Safari for defensive handling
const isIOSSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS/.test(ua);
  return iOS && webkit && notChrome;
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  // On iOS Safari, disable hoverable content to prevent unmount race conditions
  const disableHoverable = isIOSSafari();
  
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      // Prevents pointer events on content, avoiding the null target crash
      {...(disableHoverable ? { 
        onPointerDownOutside: (e) => e.preventDefault(),
        disableHoverableContent: true 
      } : {})}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  );
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

### Modifica 2: CommentItem.tsx - Conditional rendering del Tooltip

Alternativa piu conservativa: su iOS non mostrare proprio il tooltip (i tooltip hover non hanno senso su touch):

```tsx
// Helper per rilevare touch device
const isTouchDevice = () => 
  typeof window !== 'undefined' && 
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Nel JSX, renderizza condizionalmente:
{postHasSource && comment.passed_gate && (
  isTouchDevice() ? (
    // Su touch: solo icona, no tooltip (evita crash iOS)
    <img
      src={LOGO_BASE}
      alt="Lettore consapevole"
      className="w-4 h-4"
    />
  ) : (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger>
          <img
            src={LOGO_BASE}
            alt="Lettore consapevole"
            className="w-4 h-4"
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#1a2227] border-white/10">
          <p className="text-xs">Ha letto la fonte prima di commentare</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
)}
```

---

## Soluzione raccomandata

Implementare **entrambe le modifiche** per massima robustezza:

1. **tooltip.tsx**: Protezione difensiva globale per iOS Safari (beneficia tutti i tooltip dell'app)
2. **CommentItem.tsx**: Skip del tooltip su dispositivi touch (semanticamente corretto - tooltip hover non servono su touch)

---

## Impatto sugli altri flussi

| Componente | Impatto |
|------------|---------|
| CommentItem | Fix diretto - no tooltip hover su touch |
| Sidebar tooltips | Protetti dalla modifica a tooltip.tsx |
| Altri Radix components | Nessuno - isolato a Tooltip |
| Desktop experience | Invariata - tooltip funziona normalmente |

---

## Test di validazione

1. Aprire l'app su iPhone Safari
2. Scrollare rapidamente nel feed mentre i commenti sono aperti
3. Verificare che non appaia piu l'errore
4. Verificare che su desktop i tooltip funzionino ancora

---

## Rischio

- **Basso**: le modifiche sono difensive e additive
- **Rollback**: revert dei 2 file modificati
- **Compatibilita**: nessun impatto su altri browser/dispositivi
