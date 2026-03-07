

# Piano: 4 Fix (Countdown + Bottoni + Reset Voice Composer)

## Modifiche previste

### 1. Reset stato Voice nel Composer (ComposerModal.tsx)

**Problema:** Quando l'utente attiva il microfono e poi clicca "Annulla", il composer non resetta `showVoiceRecorder`, `voicePostData`, `postType` e `challengeStance`. Alla riapertura, il flusso audio è ancora attivo.

**Fix:**
- Aggiungere a `resetAllState()` (riga 395-408):
  - `setShowVoiceRecorder(false)`
  - `setVoicePostData(null)`
  - `setPostType('standard')`
  - `setChallengeStance(null)`
- Aggiornare il check "hasContent" nel bottone Annulla (riga 2035) per includere `showVoiceRecorder || voicePostData` come contenuto da confermare prima di chiudere.

### 2. Invertire bottoni Contro/A favore (AcceptChallengeFlow.tsx)

Scambiare l'ordine: "A favore" (blu) a sinistra, "Contro" (giallo) a destra.

### 3. Countdown Challenge nell'header (ImmersivePostCard.tsx)

- Aggiungere stato `challengeCountdown` + `useEffect` con `setInterval` ogni 60s per calcolare tempo rimanente da `post.challenge?.expires_at`
- Mostrare accanto al timestamp: `· ⏱ Scade tra Xh Ym` (arancione se < 2h, grigio altrimenti, "Chiusa" se scaduta)

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/composer/ComposerModal.tsx` | Reset voice state in `resetAllState` + check hasContent |
| `src/components/feed/AcceptChallengeFlow.tsx` | Inversione ordine bottoni stance |
| `src/components/feed/ImmersivePostCard.tsx` | Countdown challenge nell'header |

