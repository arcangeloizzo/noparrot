

# Fix Push Notifications - Nuovo Approccio Architetturale

## Problema di fondo

I tentativi precedenti fallivano per due motivi:
1. I trigger database non persistono dopo le migrazioni
2. Le funzioni trigger leggevano la `SUPABASE_SERVICE_ROLE_KEY` da `vault.decrypted_secrets`, ma il vault è vuoto. In Lovable Cloud i secrets sono disponibili solo come variabili d'ambiente nelle Edge Function, non nel vault Postgres.

I log confermano: ogni volta che un trigger tentava di inviare una push, falliva silenziosamente con `"SUPABASE_SERVICE_ROLE_KEY not found in vault"`.

## Soluzione: Internal Webhook Secret

Approccio a "shared secret" che bypassa il vault:

1. **Generare un secret interno** (`PUSH_INTERNAL_SECRET`) - un UUID casuale
2. **Salvarlo come secret** della Edge Function (variabile d'ambiente Deno)
3. **Hardcodarlo nelle funzioni trigger** (sicuro perché sono `SECURITY DEFINER`, il codice sorgente non è visibile agli utenti normali)
4. **Modificare la Edge Function** `send-push-notification` per accettare questo secret come metodo di autenticazione alternativo (header `x-internal-secret`)
5. **Ricreare i 3 trigger** sulla stessa migrazione

## Dettagli tecnici

### A) Nuovo secret
- Genero un UUID random come `PUSH_INTERNAL_SECRET`
- Lo aggiungo come secret tramite tool `add_secret`
- Lo inserisco come costante nelle funzioni trigger

### B) Modifica Edge Function `send-push-notification`
Aggiungere nella funzione `validateAuth()` un terzo percorso di autenticazione:

```text
validateAuth():
  1. Check Bearer == SUPABASE_SERVICE_ROLE_KEY → isServiceRole: true
  2. Check x-internal-secret == PUSH_INTERNAL_SECRET → isServiceRole: true  ← NUOVO
  3. Check JWT utente → isServiceRole: false, userId
  4. null (401)
```

### C) Riscrittura funzioni trigger
Le 3 funzioni (`trigger_push_notification`, `trigger_push_message`, `notify_admins_new_user`) useranno:

```text
PERFORM net.http_post(
  url := '...send-push-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', '<PUSH_INTERNAL_SECRET_UUID>'
  ),
  body := payload
);
```

Niente più dipendenza dal vault.

### D) Creazione trigger (nella stessa migrazione)

```text
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_notification();

CREATE TRIGGER trigger_push_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_push_message();

CREATE TRIGGER trigger_admin_on_new_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION notify_admins_new_user();
```

## Flusso risultante

```text
Utente mette Like
  → INSERT in notifications (via notify_new_reaction)
    → trigger_push_on_notification fires
      → trigger_push_notification() usa PUSH_INTERNAL_SECRET hardcoded
        → pg_net.http_post con header x-internal-secret
          → Edge Function valida il secret
            → Encrypts + sends push to Apple endpoint
              → Notifica arriva sul dispositivo
```

## Passi di implementazione

1. Chiedere all'utente di inserire il `PUSH_INTERNAL_SECRET` (UUID generato)
2. Modificare `supabase/functions/send-push-notification/index.ts` per accettare `x-internal-secret`
3. Creare migrazione SQL con: riscrittura delle 3 funzioni + creazione dei 3 trigger
4. Deploy della Edge Function

## Nessuna modifica al frontend
Il frontend e il meccanismo di subscription rimangono invariati.

