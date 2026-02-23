

# Fix Push Notification Triggers - 401 Unauthorized

## Problema
I trigger PostgreSQL che invocano la Edge Function `send-push-notification` via `pg_net` stanno fallendo con errore 401 perche mancano dell'header `Authorization` con la service role key.

## Soluzione
Aggiornare 3 funzioni PostgreSQL per includere l'header `Authorization: Bearer <service_role_key>` nelle chiamate `net.http_post`:

1. **`trigger_push_notification`** - Gestisce notifiche push per like, commenti, menzioni, follow, reshare
2. **`trigger_push_message`** - Gestisce notifiche push per messaggi diretti
3. **`notify_admins_new_user`** - Notifica gli admin quando un nuovo utente si registra (aggiunge anche l'invio push oltre alla notifica in-app gia esistente)

## Dettagli tecnici

Una singola migrazione SQL con `CREATE OR REPLACE FUNCTION` per tutte e 3 le funzioni. La chiave viene recuperata tramite `current_setting('app.settings.service_role_key', true)` che e il metodo standard per accedere ai segreti nelle funzioni PostgreSQL.

Nessuna modifica al codice frontend necessaria.

