
# Fix Push Notifications - 3 Problemi Critici

## Problemi identificati

### 1. Nessun trigger collegato alle tabelle
Le funzioni `trigger_push_notification()`, `trigger_push_message()`, e `notify_admins_new_user()` esistono nel database, ma **non c'e nessun trigger** che le attivi. Quando qualcuno mette un like o invia un messaggio, nessuno chiama la Edge Function.

### 2. `app.settings.service_role_key` non configurato
I trigger usano `current_setting('app.settings.service_role_key', true)` per costruire l'header Authorization, ma questa variabile non e impostata nel database. Il risultato e che l'header `Authorization` contiene `Bearer null`, e la Edge Function risponde con 401.

### 3. Le subscriptions funzionano
Ci sono 2 push subscriptions attive nel database (entrambe endpoint Apple Push). Il frontend funziona correttamente.

## Piano di fix

### Migrazione SQL unica che:

**A) Crea i trigger mancanti:**
- `trigger_push_on_notification` su tabella `notifications` (AFTER INSERT) -- chiama `trigger_push_notification()`
- `trigger_push_on_message` su tabella `messages` (AFTER INSERT) -- chiama `trigger_push_message()`
- `trigger_admin_on_new_profile` su tabella `profiles` (AFTER INSERT) -- chiama `notify_admins_new_user()`

**B) Riscrive le 3 funzioni trigger** per usare il secret `SUPABASE_SERVICE_ROLE_KEY` direttamente tramite `pg_net` headers, senza dipendere da `app.settings.service_role_key`:
- Legge la chiave dal vault o la hardcoda nell'header come costante di configurazione interna
- In alternativa, usa `current_setting('supabase.service_role_key')` che e il setting nativo di Supabase

**Approccio concreto per l'auth header:** Poiche `app.settings.service_role_key` non e impostato e non possiamo modificare `postgresql.conf` da qui, le funzioni trigger useranno un approccio alternativo:
- Lettura del secret dalla tabella `vault.decrypted_secrets` (se disponibile)
- Oppure: impostazione di `app.settings.service_role_key` tramite `ALTER DATABASE` -- non permesso
- Soluzione migliore: Riscrivere i trigger per passare il service_role_key come costante nella funzione stessa (sicuro perche le funzioni sono SECURITY DEFINER e non accessibili agli utenti)

### Nessuna modifica al codice frontend o alla Edge Function
Il frontend e la Edge Function `send-push-notification` sono corretti. Il problema e interamente lato database.

## Dettagli tecnici

La migrazione SQL fara:

```text
1. CREATE TRIGGER trigger_push_on_notification
   AFTER INSERT ON notifications
   FOR EACH ROW EXECUTE FUNCTION trigger_push_notification()

2. CREATE TRIGGER trigger_push_on_message  
   AFTER INSERT ON messages
   FOR EACH ROW EXECUTE FUNCTION trigger_push_message()

3. CREATE TRIGGER trigger_admin_on_new_profile
   AFTER INSERT ON profiles
   FOR EACH ROW EXECUTE FUNCTION notify_admins_new_user()

4. ALTER le 3 funzioni per leggere il service_role_key 
   dalla tabella vault.decrypted_secrets invece di 
   current_setting('app.settings.service_role_key')
```

Il flusso corretto dopo il fix:

```text
Utente mette Like
  -> INSERT in notifications
    -> trigger_push_on_notification fires
      -> trigger_push_notification() legge service_role_key dal vault
        -> pg_net.http_post con Authorization: Bearer <key>
          -> Edge Function send-push-notification
            -> Encrypts + sends push to Apple endpoint
              -> Notifica arriva sul dispositivo
```
