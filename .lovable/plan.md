
Problema reale

- L’account di Ornella non è il problema: i log di autenticazione mostrano login password riusciti con `status=200`, quindi le credenziali e il backend stanno funzionando.
- Il blocco è client-side sul telefono Android/webapp: il login riesce, ma appena l’app entra nel feed le query iniziali si piantano e dopo 12 secondi compare la schermata “Sessione scaduta”.
- Ho verificato il codice e il punto critico è ancora in `AuthContext.tsx`: subito dopo eventi auth (`SIGNED_IN` / `USER_UPDATED`) vengono avviate altre chiamate al backend (`syncPendingConsents` + query su `profiles` dentro `syncPostAuthState`).
- Inoltre `signIn()` richiama di nuovo `syncPostAuthState()` immediatamente dopo `signInWithPassword`.
- Questo combacia con un problema noto del client auth su mobile/PWA: fare chiamate backend dentro o immediatamente attorno a `onAuthStateChange` può lasciare bloccate le query successive. In questo progetto le query che poi restano appese sono soprattutto `usePosts` e `useDailyFocus`, che fanno scattare il fallback del feed.

Do I know what the issue is? Yes.

Piano

1. Pulire il bootstrap auth
- In `src/contexts/AuthContext.tsx` introdurre uno stato separato tipo `authReady` / `isHydrated`.
- Completare prima il ripristino sessione (`restoreSessionFromUrlHash` + `getSession`) e solo dopo sbloccare le query.
- Lasciare `onAuthStateChange` “puro”: aggiornamento di `session`, `user`, `loading/authReady` e basta.

2. Spostare le side effect fuori dal callback auth
- Rimuovere le chiamate a `syncPostAuthState()`:
  - dal callback `onAuthStateChange`
  - da `signIn()`
- Eseguire sync consensi / check profilo in un `useEffect` separato, dopo che l’autenticazione è stabile, eventualmente differito di un tick.
- Fare in modo che giri una sola volta per login/reset, non su refresh token o eventi ripetuti.

3. Bloccare le query finché auth non è davvero pronta
- Aggiornare `src/hooks/usePosts.ts` e `src/hooks/useDailyFocus.ts` per usare `enabled: authReady && !!user`.
- Se necessario, ritardare anche altri hook di startup che interrogano subito il backend dopo il login, in particolare `usePushNotifications`.

4. Rendere il Feed meno aggressivo nel recovery
- In `src/pages/Feed.tsx` sostituire il comportamento attuale “se entrambe le query falliscono => logout immediato” con un recupero a due step:
  1) tentare un `refreshSession()` + invalidazione query,
  2) mostrare logout solo se anche il secondo tentativo fallisce o resta appeso.
- Tenere il bottone “Esci e riaccedi” come ultima spiaggia, non come prima reazione.

5. Verifica finale mirata al caso Ornella
- Login da webapp Android
- cambio password da link email
- riapertura app con sessione già esistente
- logout -> login di nuovo
- controllo che non ricompaiano né skeleton infiniti né “Sessione scaduta” dopo login riuscito

File da toccare
- `src/contexts/AuthContext.tsx`
- `src/hooks/usePosts.ts`
- `src/hooks/useDailyFocus.ts`
- `src/pages/Feed.tsx`
- probabilmente `src/hooks/usePushNotifications.ts`

Dettaglio tecnico
```text
Flusso attuale che si rompe
login / update password riuscito
  -> onAuthStateChange(SIGNED_IN o USER_UPDATED)
  -> syncPostAuthState()
      -> syncPendingConsents()  [backend]
      -> profiles select        [backend]
  -> Feed monta
  -> usePosts / useDailyFocus partono
  -> su Android/PWA il client resta appeso
  -> dopo 12s compare "Sessione scaduta"
```

Non serve nessuna migrazione database: è un fix di orchestrazione auth lato frontend.
