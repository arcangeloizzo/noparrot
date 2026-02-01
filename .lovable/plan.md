
# Piano: Restyling Completo ComposerModal - UX Stile X (Twitter)

## Obiettivo
Trasformare il Composer dall'attuale estetica "boxed" con glow azzurro a un'esperienza fluida, professionale e minimalista ispirata a X (Twitter), mantenendo intatta tutta la logica esistente.

## Garanzie di Non-Regressione

| Funzionalità | Status | Note |
|--------------|--------|------|
| Comprehension Gate | INTATTO | Zero modifiche a logica URL detection, `loadPreview`, `handlePublish` |
| Gate OCR/Trascrizione | INTATTO | `mediaWithExtractedText` e flow rimangono invariati |
| Intent Mode (30+ parole) | INTATTO | Stesso trigger e validazione |
| Character counter (0/3000) | INTATTO | Stesso stato e visualizzazione |
| Media upload (OCR/Video) | INTATTO | `useMediaUpload` hook invariato |
| Mention dropdown | INTATTO | Stessa logica `@username` |
| Quiz/Reader flows | INTATTO | `SourceReaderGate` e `QuizModal` non toccati |

---

## Architettura Modifiche

### 1. Container Esterno (Mobile-First)

**Attuale:**
```tsx
<div className="fixed inset-0 flex items-center justify-center z-50 p-4">
  <div className="relative w-full max-w-2xl max-h-[90vh] overflow-visible
                  bg-gradient-to-b from-[#0A0F14]/98 to-[#121A23]/95 backdrop-blur-xl
                  rounded-3xl" style={{ border: '1px solid rgba(56, 189, 248, 0.15)' }}>
```

**Nuovo:**
```tsx
<div className="fixed inset-0 z-50 flex flex-col">
  {/* Backdrop solo su desktop */}
  <div className="hidden md:block absolute inset-0 bg-black/60" onClick={onClose} />
  
  {/* Container: full-screen mobile, centered modal desktop */}
  <div className={cn(
    "relative flex flex-col h-full w-full",
    "md:h-auto md:max-h-[85vh] md:w-full md:max-w-xl md:mx-auto md:my-8 md:rounded-2xl",
    "bg-zinc-950 md:bg-zinc-900",
    "border-0 md:border md:border-zinc-800"
  )}>
```

### 2. Rimozione Elementi Decorativi

**Elementi DA RIMUOVERE:**
- Light arc azzurro (linee 1348-1365)
- Glow layer (linee 1357-1365)
- Texture `urban-noise-overlay` (linea 1368)
- Gradients `from-[#0A0F14]` e border `rgba(56, 189, 248, 0.15)`
- Avatar ring glowing (`ring-2 ring-primary/30 ring-offset-2`)
- Sparkles icon nel header
- Pulsante "Pubblica" con gradient e hover glow

### 3. Header Minimalista

**Nuovo design:**
```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
  <Button 
    variant="ghost" 
    size="sm"
    onClick={onClose}
    className="text-muted-foreground hover:text-foreground"
  >
    Annulla
  </Button>
  
  <Button
    onClick={handlePublish}
    disabled={!canPublish || isLoading}
    className={cn(
      "px-4 py-1.5 rounded-full font-semibold text-sm",
      "bg-primary hover:bg-primary/90",
      "disabled:opacity-50"
    )}
  >
    {isLoading ? 'Pubblicazione...' : 'Pubblica'}
  </Button>
</div>
```

### 4. Area Input Pulita

**Nuovo Textarea:**
```tsx
<div className="flex-1 overflow-y-auto px-4 py-3">
  {/* Avatar + Textarea inline (stile X) */}
  <div className="flex gap-3">
    <Avatar className="w-10 h-10 flex-shrink-0">
      <AvatarImage src={profile?.avatar_url} />
      <AvatarFallback className="bg-zinc-800 text-zinc-400 text-sm">
        {initials}
      </AvatarFallback>
    </Avatar>
    
    <div className="flex-1 min-w-0">
      <Textarea
        ref={textareaRef}
        value={content}
        maxLength={3000}
        onChange={...}
        placeholder="Cosa sta succedendo?"
        className={cn(
          "w-full min-h-[120px] resize-none",
          "bg-transparent border-0 p-0",
          "text-[17px] leading-relaxed text-foreground",
          "placeholder:text-zinc-500",
          "focus:ring-0 focus:outline-none",
          "overflow-y-auto"
        )}
        rows={1}
      />
    </div>
  </div>
</div>
```

### 5. Sticky Toolbar (Sopra Tastiera Mobile)

**Nuovo componente inline o refactored `MediaActionBar`:**

```tsx
{/* Toolbar fissa - Mobile: sopra tastiera, Desktop: fondo area */}
<div className={cn(
  "sticky bottom-0 bg-zinc-950 border-t border-zinc-800",
  "px-4 py-2.5 flex items-center justify-between"
)}>
  {/* Sinistra: Rich Text (placeholder per ora, nessuna logica) */}
  <div className="flex items-center gap-1">
    <button 
      type="button"
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors"
      aria-label="Grassetto"
    >
      <Bold className="w-5 h-5" strokeWidth={1.5} />
    </button>
    <button 
      type="button"
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors"
      aria-label="Corsivo"
    >
      <Italic className="w-5 h-5" strokeWidth={1.5} />
    </button>
    <button 
      type="button"
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors"
      aria-label="Sottolineato"
    >
      <Underline className="w-5 h-5" strokeWidth={1.5} />
    </button>
  </div>
  
  {/* Destra: Media Group */}
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={() => cameraInputRef.current?.click()}
      disabled={disabled}
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
      aria-label="Scatta foto/video"
    >
      <Camera className="w-5 h-5" strokeWidth={1.5} />
    </button>
    <button
      type="button"
      onClick={() => imageInputRef.current?.click()}
      disabled={disabled}
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
      aria-label="Galleria immagini"
    >
      <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
    </button>
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled}
      className="p-2 rounded-full text-zinc-500 hover:text-primary hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
      aria-label="Allegati"
    >
      <Plus className="w-5 h-5" strokeWidth={1.5} />
    </button>
  </div>
  
  {/* Counter (opzionale, piccolo) */}
  <span className={cn(
    "text-xs tabular-nums ml-2",
    content.length > 2500 ? "text-amber-500" : "text-zinc-600",
    content.length >= 3000 && "text-destructive"
  )}>
    {content.length > 0 && `${content.length}/3000`}
  </span>
</div>
```

### 6. Gate Status Indicator (Discreto)

```tsx
{/* Sotto l'input, inline con media preview */}
{(detectedUrl || quotedPost) && !intentMode && gateStatus.requiresGate && (
  <div className="flex items-center gap-1.5 px-4 pb-2 text-xs text-emerald-500">
    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
    <span>Comprensione richiesta</span>
  </div>
)}
```

### 7. URL Preview Card (Minimal)

```tsx
{urlPreview && (
  <div className="mx-4 mb-3 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
    {urlPreview.image && (
      <div className="aspect-[2/1] w-full overflow-hidden">
        <img src={urlPreview.image} alt="" className="w-full h-full object-cover" />
      </div>
    )}
    <div className="px-3 py-2.5">
      <p className="text-xs text-zinc-500 mb-0.5">
        {urlPreview.domain || new URL(urlPreview.url).hostname}
      </p>
      <p className="text-sm font-medium text-foreground line-clamp-2">
        {urlPreview.title}
      </p>
    </div>
  </div>
)}
```

### 8. Pulsante Pubblica (Desktop)

Su desktop, il pulsante "Pubblica" rimane nell'header (già mostrato sopra). Caratteristiche:
- **Background**: `bg-primary` (NoParrot blue solido)
- **Hover**: `hover:bg-primary/90`
- **Border-radius**: `rounded-full`
- **Nessun glow, nessun gradient, nessun scale**

---

## File da Modificare

### `src/components/composer/ComposerModal.tsx`

1. **Linee 1330-1345**: Rimuovere backdrop blur-md, usare bg-black/60 solo desktop
2. **Linee 1336-1368**: Rimuovere container con gradient, glow arc, urban texture
3. **Linee 1370-1393**: Semplificare header (rimuovere avatar ring, sparkles)
4. **Linee 1440-1468**: Rimuovere hint text interno e spostare counter nella toolbar
5. **Linee 1500-1516**: Spostare gate indicator sotto l'input
6. **Linee 1518-1544**: Semplificare URL preview card
7. **Linee 1571-1582**: Refactoring MediaActionBar inline come toolbar
8. **Linee 1585-1615**: Rimuovere footer separato, pulsante in header

### `src/components/composer/MediaActionBar.tsx`

Opzione A: **Refactoring completo** per toolbar minimalista inline
- Rimuovere pill gradient design
- Icone outline con `strokeWidth={1.5}`
- No labels, solo icone
- Aggiungere sezione B/I/U a sinistra (placeholder senza logica)

Opzione B: **Inline nel ComposerModal** - preferibile per semplificare

---

## Struttura Finale

```
+--------------------------------------------------+
| [Annulla]                           [Pubblica]   |  <- Header minimal
+--------------------------------------------------+
|  [Avatar]  Cosa sta succedendo?                  |
|                                                   |
|            [Auto-expanding textarea]              |
|                                                   |
+--------------------------------------------------+
|  [URL Preview Card - se presente]                |
|  [Quoted Post Card - se presente]                |
|  [Media Preview Tray - se presente]              |
+--------------------------------------------------+
|  ● Comprensione richiesta (se gate attivo)       |
+--------------------------------------------------+
|  B  I  U     |     Camera  Image  Plus   1234/3000|  <- Sticky toolbar
+--------------------------------------------------+
```

---

## Palette Colori Finale

| Elemento | Colore |
|----------|--------|
| Background mobile | `zinc-950` (#09090b) |
| Background desktop modal | `zinc-900` (#18181b) |
| Bordi | `zinc-800` (#27272a) |
| Testo principale | `foreground` (white) |
| Placeholder/Muted | `zinc-500` (#71717a) |
| Icone base toolbar | `zinc-500` |
| Icone hover/active | `primary` (NoParrot blue #0A7AFF) |
| Pulsante Pubblica | `bg-primary` solido |
| Gate indicator | `emerald-500` |

---

## Test Consigliati

1. Aprire composer su mobile (full-screen, nessun glow)
2. Verificare toolbar sticky sopra tastiera iOS/Android
3. Incollare un URL e verificare che il gate si attivi
4. Caricare immagine e verificare OCR flow
5. Completare quiz e pubblicare
6. Aprire su desktop e verificare modal centered
7. Verificare che le mention (@) funzionino ancora
