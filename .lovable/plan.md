

# Piano: Ripristinare il padding laterale originale del feed

## Causa radice identificata

Ho trovato il vero problema. Nella versione originale (prima del 6 aprile), il wrapper esterno della card aveva **`p-6`** (24px di padding su tutti i lati):

```text
// Versione PRIMA (0af44b4 - 5 aprile):
<div className="... p-6 overflow-hidden ...">   ← 24px padding tutt'intorno

// Versione ATTUALE:
<div className="... overflow-hidden ...">        ← NESSUN padding
```

Quando la card è stata ristrutturata con l'architettura a overlay (header, content, action bar tutti `absolute`), il `p-6` è stato rimosso. Ma i figli `absolute inset-0` ignorano il padding del genitore, quindi anche se fosse rimasto non funzionerebbe.

La soluzione corretta è applicare un inset maggiore a tutti e tre i rail (header, content, action) per ricreare quei 24px di respiro laterale.

## Interventi

### 1. Ripristinare il respiro laterale (il problema principale)

**File: `src/components/feed/ImmersivePostCard.tsx`**

Tutti e tre i rail overlay devono avere padding laterale equivalente al vecchio `p-6` (24px):

- **Content rail** (~riga 1773): cambiare `px-5` → `px-6` (da 20px a 24px)
- **Header rail** (~riga 1606): cambiare `px-5` → `px-6`
- **Action rail** (~riga 2582): cambiare `px-5` → `px-6`

### 2. Ripristinare il centraggio di testi e immagini

Le modifiche precedenti hanno cambiato `items-center/justify-center` in `items-start/justify-start`. Ripristinare:

- Media singolo (~riga 2039): tornare a `items-center justify-center`
- Media gallery (~riga 2073): tornare a `justify-center`
- Link preview image (~riga 2374): tornare a `items-center justify-center`
- Link preview container (~riga 2364): tornare a `items-center`
- X/Twitter CTA (~riga 2168): tornare a `mx-auto` (centrato)

### 3. Non toccare

- Titoli: nessuna modifica a font size o stile
- Logica dati: nessuna modifica

## Risultato atteso

- Padding laterale di 24px su tutti i lati (come il vecchio `p-6`)
- Contenuti (testo, media, card social) centrati come prima
- Più respiro visivo tra contenuto e bordo schermo

