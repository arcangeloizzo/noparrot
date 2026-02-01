
# Fix: Deep Link Notifiche "Like al Messaggio" (In-App + Push)

## Panoramica Problema

Quando un utente riceve un like a un messaggio diretto e clicca sulla notifica:
- **Attuale**: Viene portato alla lista generale `/messages`
- **Atteso**: Viene portato alla chat specifica `/messages/:threadId?scrollTo=messageId` con il messaggio evidenziato

Questo bug colpisce sia le notifiche in-app che le push notifications.

---

## Analisi Tecnica

### Root Cause 1: Query Notifiche Incompleta
Il hook `useNotifications.ts` non recupera il `thread_id` tramite join con la tabella `messages`.

### Root Cause 2: Navigazione Generica
In `Notifications.tsx` (riga 239-240):
```typescript
} else if (notification.type === "message_like" && notification.message_id) {
  navigate(`/messages`); // ❌ Generico!
}
```

### Root Cause 3: MessageThread Senza Scroll a Messaggio
`MessageThread.tsx` non legge `useSearchParams` per lo `scrollTo` e non implementa lo scroll al messaggio specifico.

### Root Cause 4: Notifiche Realtime Incomplete
In `useNotifications.ts` (riga 133), la notifica browser per `message_like` non include l'URL corretto:
```typescript
data: { url: notif.post_id ? `/post/${notif.post_id}` : '/notifications' }
// ❌ Non gestisce message_like con thread_id!
```

### Root Cause 5: Edge Function Push Non Ottimizzata
L'Edge Function `send-push-notification` per le notifiche standard (`type: 'notification'`) non gestisce il caso `message_like` per generare l'URL al thread corretto.

---

## Soluzione Proposta

### File 1: `src/hooks/useNotifications.ts`

**Modifiche:**
1. Aggiungere interfaccia per il messaggio con `thread_id`
2. Modificare la query per includere il join con `messages`
3. Aggiornare la notifica browser per `message_like`

```typescript
// Aggiungere al type Notification:
message?: {
  id: string;
  thread_id: string;
} | null;

// Query modificata:
.select(`
  ...
  message:messages!message_id (
    id,
    thread_id
  )
`)

// Notifica browser per message_like (riga ~130):
case 'message_like':
  title = 'Like al messaggio ❤️';
  body = 'Il tuo messaggio è piaciuto!';
  // URL con thread_id (richiede query separata o invalidation)
  break;
```

**Nota**: Per la notifica realtime, il payload non include dati correlati. Dovremo usare `invalidateQueries` e lasciare che la UI gestisca la navigazione.

---

### File 2: `src/pages/Notifications.tsx`

**Modifiche:**
1. Aggiungere tipo `message` all'interfaccia `Notification`
2. Modificare `handleNotificationClick` per navigare al thread specifico con scroll

```typescript
// Interfaccia aggiornata (riga ~22):
message?: {
  id: string;
  thread_id: string;
} | null;

// Navigazione aggiornata (riga ~239):
} else if (notification.type === "message_like") {
  const threadId = notification.message?.thread_id;
  if (threadId) {
    const scrollTo = notification.message_id ? `?scrollTo=${notification.message_id}` : "";
    navigate(`/messages/${threadId}${scrollTo}`);
  } else {
    // Fallback se thread_id non disponibile
    navigate(`/messages`);
  }
}
```

---

### File 3: `src/pages/MessageThread.tsx`

**Modifiche:**
1. Importare `useSearchParams`
2. Leggere il parametro `scrollTo` (message ID)
3. Implementare scroll al messaggio specifico con highlight temporaneo
4. Aggiungere `id` attribute ai messaggi per il targeting

```typescript
// Imports:
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

// Nel componente:
const [searchParams, setSearchParams] = useSearchParams();
const scrollToMessageId = searchParams.get('scrollTo');

// Effect per scroll al messaggio:
useEffect(() => {
  if (!isReady || !scrollToMessageId) return;
  
  const messageElement = document.getElementById(`message-${scrollToMessageId}`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight temporaneo
    messageElement.classList.add('ring-2', 'ring-primary/50', 'transition-all');
    setTimeout(() => {
      messageElement.classList.remove('ring-2', 'ring-primary/50');
    }, 2000);
    
    // Pulisci URL
    setSearchParams({}, { replace: true });
  }
}, [isReady, scrollToMessageId]);
```

---

### File 4: `src/components/messages/MessageBubble.tsx`

**Modifica:**
Aggiungere `id` attribute al wrapper del messaggio per permettere il targeting.

```typescript
// Riga ~144, aggiungere id:
<div 
  id={`message-${message.id}`}
  className={cn('flex gap-2 mb-4', isSent ? 'flex-row-reverse' : 'flex-row')}
>
```

---

### File 5: `supabase/functions/send-push-notification/index.ts`

**Modifiche:**
Aggiungere gestione per `notification_type: 'message_like'` nel blocco notifiche standard.

```typescript
// Dopo il blocco switch per notification_type (riga ~189), aggiungere:
case 'message_like':
  title = `${actorName} ha messo like al tuo messaggio`;
  // Recuperare thread_id dal message_id
  if (body.message_id) {
    const { data: msg } = await supabase
      .from('messages')
      .select('thread_id')
      .eq('id', body.message_id)
      .single();
    
    url = msg?.thread_id 
      ? `/messages/${msg.thread_id}?scrollTo=${body.message_id}`
      : '/messages';
  } else {
    url = '/messages';
  }
  break;
```

---

### File 6: `public/sw.js`

**Nessuna modifica richiesta**: Il Service Worker già gestisce correttamente l'URL passato nel payload tramite `data.url`. Una volta che l'Edge Function genera l'URL corretto, il SW lo utilizzerà.

---

## Riepilogo Modifiche

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/hooks/useNotifications.ts` | Modifica | Aggiungere join con `messages` per recuperare `thread_id` |
| `src/pages/Notifications.tsx` | Modifica | Navigare a `/messages/:threadId?scrollTo=messageId` |
| `src/pages/MessageThread.tsx` | Modifica | Implementare scroll e highlight al messaggio |
| `src/components/messages/MessageBubble.tsx` | Modifica | Aggiungere `id` attribute per targeting |
| `supabase/functions/send-push-notification/index.ts` | Modifica | Generare URL corretto per `message_like` |

**Totale: 5 file, ~50 righe di codice**

---

## Garanzie Anti-Regressione

| Garanzia | Dettaglio |
|----------|-----------|
| SessionGuard intatto | Nessuna modifica alle logiche di autenticazione |
| Realtime DM intatto | Nessuna modifica alla sincronizzazione messaggi |
| Scroll state preservato | Il nuovo scroll è additivo, non sostituisce la logica esistente |
| Fallback sicuro | Se `thread_id` non disponibile, fallback a `/messages` |

---

## Test Consigliati

1. **Notifica In-App**: Ricevi un like a un messaggio → clicca notifica → verifica navigazione a chat corretta con messaggio evidenziato
2. **Push iOS**: Con app chiusa, ricevi push per like messaggio → clicca → verifica apertura app su chat corretta
3. **Push Android**: Stesso test di iOS
4. **Fallback**: Simula notifica senza `thread_id` → verifica navigazione a `/messages`
5. **Scroll Existing Chat**: Se già nella stessa chat, verifica che lo scroll al messaggio funzioni senza re-render completo
