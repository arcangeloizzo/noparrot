

# Piano: Navigazione al profilo da avatar/nome

## Problema
Cliccando su avatar o nome autore nel feed e nei commenti non si naviga al profilo dell'utente. Il codice in `ImmersivePostCard` ha già gli handler `onClick` con `navigate(/profile/${post.author.id})`, ma c'è un problema di stacking context che li rende non cliccabili.

## Causa root
In `ImmersivePostCard.tsx`, il "Content Layer" è un div con `className="relative z-10"` (riga 1600). Al suo interno, il wrapper dell'avatar ha `z-50`, ma questo z-index vale solo **dentro** il contesto di stacking del parent `z-10`. Il `Header` della navigazione in `Feed.tsx` è `fixed z-50` a livello page, quindi ha un z-index effettivo superiore e intercetta i click nell'area dell'avatar — il header è `bg-transparent` ma cattura i pointer events.

Inoltre, `CommentItem.tsx` e `CollapsiblePostHeader.tsx` non hanno alcuna navigazione su avatar/nome.

## Modifiche

### 1. `src/components/feed/ImmersivePostCard.tsx`
- Alzare il z-index del "Content Layer" da `z-10` a `z-20` per posizionarlo sopra gli overlay gradient ma sotto il bottom nav
- In alternativa (più sicuro): aggiungere `pointer-events-none` al `Header` wrapper in Feed.tsx quando è in modalità immersive, con `pointer-events-auto` solo sull'icona notifiche — dato che il header immersivo è trasparente e serve solo per mostrare logo e notifiche

### 2. `src/components/navigation/Header.tsx`
- Aggiungere `pointer-events-none` al `<header>` in modalità immersive
- Aggiungere `pointer-events-auto` ai figli interattivi (logo, icona notifiche)

### 3. `src/components/feed/CommentItem.tsx`
- Importare `useNavigate` da react-router-dom
- Wrappare avatar (riga 247-249) e nome autore (riga 254-256) con click handler che navigano a `/profile/${comment.author.id}`
- Aggiungere `e.stopPropagation()` e `cursor-pointer`

### 4. `src/components/feed/CollapsiblePostHeader.tsx`
- Importare `useNavigate`
- Aggiungere navigazione al profilo su avatar e nome sia nello stato collapsed che expanded
- Usare `post.author.id` o `comment.author.id` a seconda del contesto

## Nessuna modifica a
- Backend, database, Edge Functions, profili AI

