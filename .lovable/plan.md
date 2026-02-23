
# Fix Edge Function Build Errors + Push Notification Crash

## Problema principale
La Edge Function `send-push-notification` crasha all'avvio con un errore fatale:
```
TypeError: Object prototype may only be an Object or null: undefined
    at https://esm.sh/jws@4.0.1/es2022/jws.mjs
```

La libreria `web-push` (via esm.sh) dipende da moduli Node.js (`jws`, `crypto`) incompatibili con Deno. **Non basta fare re-deploy** -- il codice va riscritto.

## Soluzione: Riscrivere send-push-notification con Web Crypto API native

Sostituire completamente l'import di `web-push` con un'implementazione nativa che usa:
- **Web Crypto API** (nativa in Deno) per firmare i JWT VAPID
- **Fetch API** per inviare le push notification direttamente agli endpoint

L'approccio usa:
1. Firma VAPID JWT con ECDSA P-256 via `crypto.subtle`
2. Encryption del payload con ECDH + AES-128-GCM (standard Web Push RFC 8291)
3. Invio diretto via `fetch()` agli endpoint push

## Fix aggiuntivi: 11 errori TypeScript nelle altre Edge Functions

### 1. `cleanup-expired-cache/index.ts` (riga 123)
- `error` is of type `unknown` -- aggiungere cast `(error as Error).message`

### 2. `fetch-daily-focus/index.ts` (righe 526, 547, 553, 561)
- Parameter `e` implicitly has `any` type -- aggiungere tipo esplicito `(e: any)`

### 3. `generate-infographic/index.ts` (riga 169)
- `Uint8Array<ArrayBufferLike>` non assegnabile -- cast con `as Uint8Array`

### 4. `get-trust-score/index.ts` (riga 128)
- `error` is of type `unknown` -- aggiungere cast `(error as Error).message`

### 5. `publish-post/index.ts` (riga 589)
- Type mismatch su `supabase` client -- aggiungere cast `as any`

### 6. `send-push-notification/index.ts` (riga 195)
- Index expression not of type `number` -- aggiungere cast `(profile as any)[preferenceField]`

### 7. `test-supadata/index.ts` (righe 69-70)
- `error` is of type `unknown` -- aggiungere cast `(error as Error)`

## Dettagli tecnici: Implementazione Web Push nativa

```text
+----------------------------------+
| send-push-notification/index.ts  |
+----------------------------------+
| 1. Import crypto.subtle (native) |
| 2. generateVapidHeaders()        |
|    - Create JWT with ES256       |
|    - Sign with VAPID private key |
| 3. encryptPayload()              |
|    - ECDH key agreement          |
|    - AES-128-GCM encryption      |
|    - RFC 8291 framing            |
| 4. fetch(endpoint, encrypted)    |
+----------------------------------+
```

L'implementazione mantiene tutte le funzionalita esistenti (auth validation, notification preferences, subscription cleanup) -- cambia solo il layer di invio push.

## Sequenza di implementazione
1. Fix dei 6 file con errori TypeScript minori (in parallelo)
2. Riscrittura completa di `send-push-notification/index.ts` con Web Crypto
3. Deploy automatico di tutte le funzioni
