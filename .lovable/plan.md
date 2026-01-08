# Piano: Redesign Onboarding "Direct Impact" NoParrot v2.0

## Obiettivo
Trasformare l'onboarding in un'esperienza "militare/cruda", diretta, con sfida esplicita e impegno psicologico dell'utente. Target: 30-45 anni, urban, informed.

---

## Nuovo Flusso (6 step)

```
Splash (logo reveal) -> Slide 1-4 -> Consent/Privacy -> AuthPage
```

### Step 0: Splash Screen (invariato ma ottimizzato)
- Logo parrot + wordmark reveal
- Auto-fade dopo 3s verso Slide 1

### Step 1: Il Nemico (Slide 1)
- **Visual**: Logo NoParrot (solo pappagallo) grande, centrato, blu accent
- **Titolo**: "Non fare il pappagallo."
- **Sottotitolo**: "I social sono echi infiniti. Qui si condivide solo cio che si e compreso. Spezza la catena."
- **Interazione**: Swipe o tap

### Step 2: La Difesa (Slide 2)
- **Visual**: Icona lucchetto che si trasforma in spunta (Check) - animata
- **Titolo**: "Prima capisci. Poi posti."
- **Sottotitolo**: "Vuoi condividere un link? L'AI ti fara 3 domande. Se non hai letto o non hai capito, non passa. Nessuna eccezione."
- **Interazione**: Button "Continua"

### Step 3: L'Autore (Slide 3)
- **Visual**: Icona penna stilografica + nebulosa stilizzata (composizione)
- **Titolo**: "Il tuo Diario Cognitivo."
- **Sottotitolo**: "Niente post usa e getta. Il tuo profilo e un blog personale dove cio che scrivi e cio che comprendi costruisce la tua identita. Lascia un segno, non solo rumore."
- **Interazione**: Button "Continua"

### Step 4: Il Patto (Slide 4)
- **Visual**: Schermo nero, focus totale sullo slider in basso
- **Titolo**: "NoParrot richiede tempo."
- **Sottotitolo**: "Stai scegliendo l'attrito al posto della comodita. Sei sicuro?"
- **Interazione**: Slider "Slide to Unlock" con icona lucchetto
  - Testo: "SCORRI PER ACCETTARE LA SFIDA ->"
  - Feedback: vibrazione (haptics.success) al completamento
  - Animazione: lucchetto diventa spunta

### Step 5: Il Rispetto (Slide 5 / Consent)
- **Visual**: Icona rete/nodi connessi o scudo privacy stilizzato
- **Titolo**: "I dati servono a te."
- **Sottotitolo**: "Non vendiamo la tua identita a terzi. La tua mappa cognitiva serve a te, non al mercato. La pubblicita? Ci sara, ma alle tue condizioni: trasparente, etica e sotto il tuo controllo. Niente sorveglianza."
- **Contenuto GDPR**: Checkboxes Terms/Privacy + Toggle cognitive tracking
- **Azione**: Button "Crea il tuo account" -> AuthPage

---

## File da Modificare/Creare

### 1. `src/components/onboarding/SplashScreen.tsx`
- Nessuna modifica sostanziale, gia ottimizzato

### 2. `src/components/onboarding/OnboardingSlides.tsx` - RISCRIVERE COMPLETAMENTE
- 4 nuove slide (Il Nemico, La Difesa, L'Autore, Il Patto)
- Rimuovere FeedPreviewMock
- Aggiungere icone vettoriali custom (Lucide icons)
- Implementare SlideToUnlock component per Slide 4

### 3. `src/components/onboarding/SlideToUnlock.tsx` - NUOVO
- Componente slider draggable
- Icona lucchetto che diventa spunta
- Haptic feedback al completamento
- Callback onUnlock

### 4. `src/pages/ConsentScreen.tsx` - REDESIGN VISIVO
- Integrare come "Slide 5" nel flow
- Aggiungere icona rete/scudo in alto
- Aggiungere titolo "I dati servono a te."
- Aggiungere sottotitolo trasparenza
- Mantenere logica GDPR esistente
- Cambiare button da "Continua" a "Crea il tuo account"

### 5. `src/pages/OnboardingFlow.tsx` - SEMPLIFICARE
- Rimuovere step "ready" (ReadyScreen eliminato)
- Flow: splash -> slides (4) -> consent -> auth

### 6. `src/components/onboarding/ReadyScreen.tsx` - ELIMINARE
- Non piu necessario, sostituito da slider in Slide 4

### 7. `src/components/onboarding/FeedPreviewMock.tsx` - ELIMINARE
- Non piu usato nel nuovo flow

---

## Stile Visivo (da immagine di riferimento)

| Elemento | Specifica |
|----------|-----------|
| Background | `#000000` o `#0A0A0A` (nero puro/profondo) |
| Accent | `#3B82F6` (Blu NoParrot / primary) |
| Font Titoli | `text-3xl md:text-4xl font-bold`, tracking stretto |
| Font Sottotitoli | `text-base text-white/70`, line-height rilassato |
| Icone | Lucide icons, size 80-120px, `stroke-[1.5]`, colore primary |
| Layout | Centrato verticalmente, padding laterale 32px |
| Animazioni | Solo fade-in, slide-up. Nessun glow, nessuna particella |

---

## Icone da Usare (Lucide)

| Slide | Icona Lucide |
|-------|--------------|
| Slide 1 | Logo NoParrot custom (gia esistente) |
| Slide 2 | `Lock` + `Check` (animazione morph) |
| Slide 3 | `PenLine` + custom nebula SVG |
| Slide 4 | Slider custom con `Lock` -> `Check` |
| Slide 5 | `Network` o `Shield` |

---

## Implementazione SlideToUnlock

```tsx
// Pseudo-codice
<SlideToUnlock onUnlock={() => nextSlide()}>
  <div className="slider-track">
    <div className="slider-thumb">
      <Lock /> // diventa <Check /> al 100%
    </div>
    <span>SCORRI PER ACCETTARE LA SFIDA</span>
  </div>
</SlideToUnlock>
```

- Usa `onPointerDown/Move/Up` per drag
- Threshold: 90% della track = unlock
- Al rilascio sotto 90%: spring back
- Al 100%: haptics.success() + callback

---

## Ordine di Implementazione

1. Creare `SlideToUnlock.tsx` (componente riutilizzabile)
2. Riscrivere `OnboardingSlides.tsx` con 4 nuove slide
3. Redesign visivo `ConsentScreen.tsx` (Slide 5)
4. Aggiornare `OnboardingFlow.tsx` (rimuovere ready step)
5. Eliminare `ReadyScreen.tsx` e `FeedPreviewMock.tsx`

---

## Note Critiche

- **GDPR**: La logica consent rimane invariata (checkboxes + toggles)
- **AuthPage**: Rimane separata, riceve utente dopo consent
- **Haptics**: Gia implementato in `src/lib/haptics.ts`
- **No breaking changes**: Solo onboarding, nessun impatto su feed/auth esistenti
- **Target**: 30-45 anni, tono serio/sfidante, no playful

---

## Critical Files for Implementation

- `src/components/onboarding/OnboardingSlides.tsx` - Core slides logic to rewrite
- `src/pages/ConsentScreen.tsx` - Consent UI to redesign visually
- `src/pages/OnboardingFlow.tsx` - Flow controller to simplify
- `src/lib/haptics.ts` - Haptic feedback utilities (already exists)
- `src/components/ui/logo.tsx` - Logo component reference
