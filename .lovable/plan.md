
# Fix Nomi Utente Non Visibili nelle Notifiche

## Problema Identificato
La schermata notifiche mostra "Utente" come placeholder e un "?" invece dell'avatar perché la query nel hook `useNotifications.ts` sta ancora usando la tabella `profiles` (ora ristretta da RLS) invece della vista `public_profiles`.

## Causa Tecnica
- Riga 55 in `src/hooks/useNotifications.ts`:
  ```typescript
  actor:profiles!actor_id (...)
  ```
- Con le nuove policy RLS, la tabella `profiles` restituisce dati solo per l'utente corrente
- Per gli altri utenti, `actor` risulta `null`, causando il fallback a "Utente" e "?"

## Soluzione

### Modifica a `src/hooks/useNotifications.ts`
Cambiare il join da `profiles` a `public_profiles`:

```typescript
// Prima (riga 55)
actor:profiles!actor_id (
  id,
  username,
  full_name,
  avatar_url
)

// Dopo
actor:public_profiles!actor_id (
  id,
  username,
  full_name,
  avatar_url
)
```

## Risultato Atteso
- Avatar degli utenti visibili correttamente
- Nomi utente mostrati al posto di "Utente"
- Stesso pattern già applicato con successo a:
  - `usePosts.ts`
  - `useMessageThreads.ts`
  - `useComments.ts`
  - `useMediaComments.ts`
  - `Post.tsx`

## Sezione Tecnica

| File | Modifica |
|------|----------|
| `src/hooks/useNotifications.ts` | Riga 55: `profiles` → `public_profiles` |

La vista `public_profiles` è una Security Definer view che espone solo i campi pubblici (id, username, full_name, avatar_url) bypassando le RLS restrictions sulla tabella base `profiles`.
