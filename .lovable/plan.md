
# Piano: Ripristinare padding laterale nel feed

## Problema
Il content rail (zona centrale con testo, media, sondaggi) usa `px-4` (16px) mentre header e action bar usano `px-5` (20px). Negli screenshot "prima" il padding era uniforme a 20px.

## Modifica

### File: `src/components/feed/ImmersivePostCard.tsx`
- **Riga ~1773**: Cambiare `px-4` → `px-5` nel className del content rail (`absolute inset-0 flex flex-col px-4` → `px-5`)

Nessuna modifica ai titoli o ad altri elementi.
