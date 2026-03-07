

# Fix: Challenge Responses + Notifiche Challenge

## Problemi identificati

1. **Risposte alla challenge non visibili**: `ImmersivePostCard` non carica ne mostra i challenger. Anche `FeedCardAdapt` passa `responses: []` hardcoded.
2. **Notifica non salvata nel DB**: `submit-challenge-response` invia solo il push ma non inserisce un record nella tabella `notifications`. Per questo la notifica non compare nella schermata Notifiche.
3. **Tipo notifica non gestito nel frontend**: `getNotificationText` e `getNotificationIcon` in `Notifications.tsx` non gestiscono il tipo `challenge_response`, quindi mostra il fallback "ha interagito con te".
4. **Push notification generica**: `send-push-notification` non gestisce il tipo `challenge_response` per personalizzare il testo push.

## Piano modifiche

### 1. Mostrare le risposte nella Challenge Card (ImmersivePostCard.tsx)
- Importare e usare `useChallengeResponses` per caricare i challenger quando `isChallengePost`
- Dopo la polarization bar e prima del CTA, renderizzare la lista dei challenger con il loro `VoicePlayer`, stance badge, e pulsante voto "Miglior argomento"
- Sezione collassabile ("Vedi N risposte" / "Nascondi risposte")

### 2. Caricare le risposte anche in FeedCardAdapt.tsx
- Importare `useChallengeResponses` e passare `responses` reali a `ChallengeCard` invece di `[]`

### 3. Inserire notifica nel DB (submit-challenge-response Edge Function)
- Aggiungere un INSERT nella tabella `notifications` con `type: 'challenge_response'` prima del push, in modo che compaia nella schermata Notifiche:
```sql
INSERT INTO notifications (user_id, actor_id, type, post_id)
VALUES (challengePost.author_id, userId, 'challenge_response', challenge.post_id)
```

### 4. Gestire tipo `challenge_response` nel frontend Notifiche (Notifications.tsx)
- `getNotificationIcon`: aggiungere case `challenge_response` con icona `Zap` (rossa)
- `getNotificationText`: aggiungere case `challenge_response` → "ha risposto alla tua challenge"
- Click handler: navigare al post della challenge (`/post/:postId`)

### 5. Personalizzare push notification (send-push-notification Edge Function)
- Aggiungere gestione del tipo `challenge_response` nel body del push per mostrare "X ha risposto alla tua challenge" invece del testo generico

### 6. Aggiungere `challenge_response` al tipo Notification (useNotifications.ts)
- Estendere il type union per includere `'challenge_response'`

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/feed/ImmersivePostCard.tsx` | Caricare e mostrare lista challenger |
| `src/components/feed/FeedCardAdapt.tsx` | Passare risposte reali a ChallengeCard |
| `supabase/functions/submit-challenge-response/index.ts` | INSERT notifica nel DB |
| `supabase/functions/send-push-notification/index.ts` | Gestire tipo `challenge_response` |
| `src/pages/Notifications.tsx` | Icona, testo e navigazione per `challenge_response` |
| `src/hooks/useNotifications.ts` | Aggiungere tipo al union |

