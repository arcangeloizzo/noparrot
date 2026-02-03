
# Piano: Eliminare le Notifiche Push Duplicate

## Causa del Problema

Esistono **trigger duplicati** sulle stesse tabelle che invocano la stessa funzione di push notification:

### Tabella `public.notifications` - 2 trigger identici
| Trigger | Migrazione | Funzione |
|---------|------------|----------|
| `on_notification_created` | 20251206... | `trigger_push_notification()` |
| `on_new_notification_push` | 20251208... | `trigger_push_notification()` |

Ogni volta che viene creata una notifica (like, follow, commento, menzione, reshare), entrambi i trigger scattano e inviano **2 push** identiche.

### Tabella `public.messages` - 2 trigger identici
| Trigger | Migrazione | Funzione |
|---------|------------|----------|
| `on_message_created` | 20251206... | `trigger_push_message()` |
| `on_new_message_push` | 20251208... | `trigger_push_message()` |

Stesso problema per i messaggi diretti.

### Caso Admin - Tripla notifica potenziale
La funzione `notify_admins_new_user()` fa **due cose** quando un utente si registra:
1. Inserisce in `public.notifications` (scatena i 2 trigger di cui sopra)
2. Chiama **direttamente** `net.http_post` alla Edge Function

Questo causa potenzialmente **3 notifiche** per ogni nuova registrazione agli admin.

---

## Soluzione

Una singola migrazione SQL per rimuovere i trigger ridondanti e pulire la funzione admin:

```sql
-- 1. Rimuovi trigger duplicato su notifications (manteniamo on_new_notification_push)
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;

-- 2. Rimuovi trigger duplicato su messages (manteniamo on_new_message_push)
DROP TRIGGER IF EXISTS on_message_created ON public.messages;

-- 3. Aggiorna la funzione admin per rimuovere la chiamata HTTP diretta
-- (il trigger on_new_notification_push si occupa gia' dell'invio push)
CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, created_at)
    VALUES (
      admin_record.user_id,
      NEW.id,
      'new_user',
      NOW()
    );
  END LOOP;
  
  -- NOTA: La push viene inviata automaticamente dal trigger 
  -- on_new_notification_push sulla tabella notifications
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create admin notification: %', SQLERRM;
  RETURN NEW;
END;
$$;
```

---

## Risultato Atteso

| Evento | Prima (bug) | Dopo (fix) |
|--------|-------------|------------|
| Like al post | 2 push | 1 push |
| Nuovo follower | 2 push | 1 push |
| Nuovo commento | 2 push | 1 push |
| Menzione | 2 push | 1 push |
| Reshare | 2 push | 1 push |
| Messaggio DM | 2 push | 1 push |
| Nuova registrazione (admin) | 3 push | 1 push |

---

## File da Modificare

Nessun file di codice - solo una migrazione SQL al database.
