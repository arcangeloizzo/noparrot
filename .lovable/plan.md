
# Piano: Fix posizione MentionDropdown nei commenti

## Problema

Quando l'utente digita `@` nel composer dei commenti per menzionare qualcuno, il dropdown con i suggerimenti utenti appare **sotto** il campo di input. Dato che il composer è fisso in fondo allo schermo e la tastiera mobile è attiva, il dropdown viene completamente coperto dalla tastiera e risulta invisibile.

## Analisi tecnica

In `CommentsDrawer.tsx` (linee 594-606):

```tsx
{/* Mention dropdown */}
{showMentions && (
  <div className="relative mt-2 pl-11">
    <MentionDropdown
      users={mentionUsers}
      selectedIndex={selectedMentionIndex}
      onSelect={handleSelectMention}
      isLoading={isSearching}
      position="below"   // ❌ Problema: appare sotto il composer
      containerRef={composerContainerRef}
    />
  </div>
)}
```

La prop `position="below"` combinata con il posizionamento DOM dopo il composer causa il problema.

---

## Soluzione

Spostare il `MentionDropdown` **prima** dell'input e cambiare `position` a `"above"`, in modo che il dropdown appaia sopra il composer, nell'area scrollabile visibile.

### Modifica CommentsDrawer.tsx

Il MentionDropdown deve essere posizionato in modo che appaia sopra la riga del composer:

```tsx
{/* Mention dropdown - ABOVE the composer row */}
{showMentions && (
  <div className="relative mb-2 pl-11">
    <MentionDropdown
      users={mentionUsers}
      selectedIndex={selectedMentionIndex}
      onSelect={handleSelectMention}
      isLoading={isSearching}
      position="above"   // ✅ Ora appare sopra
      containerRef={composerContainerRef}
    />
  </div>
)}

{/* Compact composer row */}
<div className="flex gap-2 items-center" ref={composerContainerRef}>
  ...
</div>
```

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/feed/CommentsDrawer.tsx` | Spostare MentionDropdown sopra il composer row e cambiare position a "above" |

---

## Dettagli dell'implementazione

1. **Rimuovere** il blocco MentionDropdown dalla posizione attuale (linee 594-606)
2. **Inserirlo** prima del `composerContainerRef` div (prima della linea 486)
3. **Cambiare** `position="below"` a `position="above"`
4. **Cambiare** `mt-2` (margin-top) a `mb-2` (margin-bottom)

### Risultato visivo atteso

```
┌─────────────────────────────────┐
│ [Lista commenti...]             │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📷 Marco Rossi              │ │ ← Dropdown SOPRA
│ │ @marcorossi                 │ │
│ ├─────────────────────────────┤ │
│ │ 📷 Maria Russo              │ │
│ │ @mariarusso                 │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 👤 [ @mar█              📷] [Invia] │ ← Composer
├─────────────────────────────────┤
│ ⌨️ Tastiera iOS                │
└─────────────────────────────────┘
```

---

## Impatto sugli altri flussi

| Componente | Impatto |
|------------|---------|
| CommentsDrawer | Fix diretto - nessun impatto su altre funzionalità |
| CommentItem | Nessuno |
| Gate/Quiz flow | Nessuno - logica separata |
| Enhanced reactions | Nessuno |
| StickyComposer | Nessuno - già usa position="below" ma in contesto diverso |

---

## Test di validazione

1. Aprire il drawer dei commenti su un post
2. Iniziare a digitare `@mar` nel campo di testo
3. Verificare che il dropdown appaia **sopra** il campo di input
4. Verificare che sia visibile anche con la tastiera aperta
5. Selezionare un utente e verificare che la menzione venga inserita correttamente
6. Testare anche su iPhone per confermare la visibilità

---

## Rischio

- **Basso**: modifica isolata al posizionamento DOM
- **Rollback**: ripristino della posizione originale
- **Compatibilità**: nessun impatto su altri browser/dispositivi
