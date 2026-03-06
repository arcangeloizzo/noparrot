

# Fix VapidPkHashMismatch - Auto-resubscribe

## Problema
La push subscription dell'utente è stata registrata con una VAPID public key diversa da quella attuale. Apple rifiuta il push con errore `VapidPkHashMismatch`. Altri utenti con subscription più recenti funzionano correttamente.

## Soluzione

### 1. Edge Function: Rilevare e pulire subscription stale
In `send-push-notification`, quando Apple risponde con `VapidPkHashMismatch` (status 400), cancellare automaticamente la subscription dal database. Al prossimo avvio dell'app PWA, il client si ri-registrerà con le VAPID key corrette.

Modifica in `send-push-notification/index.ts`:
- Dopo un errore 400/410 da Apple, DELETE la riga da `push_subscriptions` usando l'endpoint
- Log dell'operazione di cleanup

### 2. Frontend: Forzare re-subscribe all'avvio
In `usePushNotifications`, all'avvio:
- Confrontare la VAPID public key attuale con quella usata per la subscription esistente
- Se diversa, unsubscribe dal browser e cancellare dal DB, poi ri-registrare
- Questo previene futuri mismatch

### Passi implementativi
1. Modificare la Edge Function per auto-cleanup delle subscription con errore `VapidPkHashMismatch` o status 410 Gone
2. Modificare `usePushNotifications` per forzare re-subscribe quando rileva una subscription potenzialmente stale (confronto applicationServerKey)
3. Cancellare manualmente la subscription stale dell'utente dal DB (query una tantum)

