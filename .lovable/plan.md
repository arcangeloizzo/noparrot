

# Fix UI Challenge Card: Drawer risposte + Barra polarizzazione + Bottone "Vedi risposte"

## Modifiche

### 1. Drawer scrollabile per le risposte (ImmersivePostCard.tsx)
- Sostituire la sezione collassabile inline (righe 1681-1745) con un **Drawer** (Vaul, già disponibile nel progetto) che si apre al click su "Vedi risposte"
- Il Drawer conterrà la lista completa dei challenger con VoicePlayer, stance badge e pulsante voto, tutto scrollabile
- Rimuovere lo state `showChallengeResponses` e il rendering inline

### 2. Barra di polarizzazione più visibile (righe 1657-1665)
- Aumentare altezza barra da `4px` a `8px` con bordi arrotondati più marcati
- Aumentare font percentuali da `fontSize: 12` a `fontSize: 14` con `fontWeight: 900`
- Colore azzurro: usare `#3B9FFF` (più luminoso) al posto di `#0A7AFF` per leggibilità su sfondo scuro

### 3. Bottone "Vedi risposte" più impattante (righe 1670-1680)
- Centrare il bottone (`justify-center w-full`)
- Sostituire icona `Mic` con `Zap` (icona challenge)
- Stile: sfondo glassmorphic (`rgba(255,255,255,0.1)`, `backdrop-blur`), padding maggiore, `rounded-full`, font più grande (`text-sm font-bold`)
- Testo: `⚡ Vedi N risposte` / `⚡ Vedi 1 risposta`

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/feed/ImmersivePostCard.tsx` | Drawer per risposte, barra polarizzazione, bottone "Vedi risposte" |

