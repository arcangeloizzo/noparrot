# Piano Blocchi B + C + D

Blocco A (z-index AuthPromptSheet → z-[80]) è già stato applicato. Ecco il piano per il resto — grande e trasversale, quindi voglio la tua approvazione prima di scrivere.

## Blocco C — Password policy (lo faccio PRIMA, è precondizione del Passo 2 auth)

1. **Scoperta della policy reale**: la Supabase Auth API espone `password_min_length`, `password_required_characters`, `password_hibp_enabled` via `GET /auth/v1/settings` (pubblico con anon key). Faccio quella chiamata dal sandbox e leggo la verità. Se non sono esposti tutti i flag, tento un signup controllato con password deboli progressive (es. `a`, `aaaaaa`, `aaaaaaaa`, `Aaaaaaaa`, `Aaaaaaa1`) usando email random `+test@` non verificate, senza mai completare OTP, per dedurre classi richieste. Nessun utente reale creato.
2. **Fonte unica** `src/config/passwordPolicy.ts`: esporta `PASSWORD_POLICY = { minLength, requireLower, requireUpper, requireDigit, requireSymbol, hibpEnabled }` + `checkPassword(pw): { ok, checks: Array<{id,label,ok}>, message? }` con label in italiano.
3. **HIBP in registrazione**: se `hibpEnabled` è on server-side, il messaggio "compromessa" arriva già dal server → catturo l'errore Supabase (`weak_password` / `pwned`) e mostro il messaggio italiano dedicato. Nessuna chiamata client aggiuntiva a HIBP.
4. Se la policy non è determinabile con certezza dopo entrambi i tentativi, lo dico nel report e uso i requisiti che ho osservato senza inventare.

## Blocco B — Onboarding v2

Filosofia: intro = mini-feed con snap verticale, stessa grammatica shell.

### B1 File nuovi
- `src/components/onboarding/OnboardingFeed.tsx` — contenitore snap verticale, rail 4 segmenti (right 12px), pulsante "SALTA →" fisso, hint "SCORRI" con chevron animato nascosto su card 4. Rileva la card attiva via IntersectionObserver.
- `src/components/onboarding/cards/CardWelcome.tsx` (card 1)
- `src/components/onboarding/cards/CardGate.tsx` (card 2 con mini-quiz visivo non-interattivo)
- `src/components/onboarding/cards/CardDiary.tsx` (card 3 con mini-nebulosa statica + contatore "33")
- `src/components/onboarding/cards/CardTry.tsx` (card 4 con due .crow verso reader/spotify demo)

Copy verbatim come da brief (parola PAPPAGALLO intera su una riga tramite `<br/>` esplicito, non wrap CSS).

### B2 Reader/ascolto demo restyle
- `src/pages/DemoGateFlow.tsx` — refactor: header mono con "← Indietro", titolo Anton, card fonte con costola territorio, CTA blu "Ho letto/ascoltato, mettiamo a fuoco →". Rimuovo bottone rosa.
- Il quiz demo **riusa il componente reale del gate**. Il gate reale vive in `src/lib/comprehension-gate-extended.tsx` (o simile — leggo per confermare). Se estrarlo è a rischio, replico fedelmente lo stile e lo segnalo nel report.

### B3 Esiti gate demo
Restyle degli schermi FAIL/PASS dentro `DemoGateFlow.tsx`:
- FAIL: eyebrow pink, Anton "QUASI.", copy dato, primario "Rileggi e riprova" + ghost "Salta e crea l'account →". Via X grigia.
- PASS: eyebrow teal, Anton "HAI MESSO / A FUOCO.", copy dato + badge "HA LETTO" reale (importo la stessa primitiva usata in `CommentItem`), CTA blu "Crea il tuo account →".

### B4 Wiring
- `src/pages/OnboardingFlow.tsx` — `slides` step ora rende `OnboardingFeed`, che al completamento (o via "SALTA →" / card 4 CTA / esito PASS/FAIL "crea account") chiama `handleSlidesComplete` → demo/consent/auth. Rimuovo `OnboardingSlides` dal render ma **non elimino il file** in questa passata (safety net).

## Blocco B5 + Blocco D — Auth redesign in 3 passi + persistenza consensi

### Analisi consensi (Blocco D, prima delle modifiche)
- Leggo `src/pages/ConsentScreen.tsx`, `src/hooks/useUserConsents.ts`, `src/pages/SettingsPrivacy.tsx`, `src/hooks/useCognitiveTracking.ts` per rispondere alle 4 domande.
- Tabella `user_consents` esiste già (visto in schema): 11 colonne. Ha `accepted_terms`, `accepted_privacy`, `ads_personalization_opt_in`, `consent_version`, `terms_accepted_at`, `privacy_accepted_at`, `ads_opt_in_at`. **Persistenza consensi OK**. Verifico che il passo 3 del nuovo auth chiami `useUpsertConsents`.
- `cognitive_tracking_enabled` è su `profiles` e il hook `useCognitiveTracking` lo aggiorna. Lo leggo in `useCognitiveDensity`? Devo verificare — questo è parte del report D.
- Riporto tutto senza toccare comportamenti del tracking.

### B5 Auth redesign
- Refactor `src/components/auth/AuthPage.tsx`: 
  - shell: fondo `#0E1522`, titoli Anton left-aligned, label mono 9.5px uppercase sopra input, input vetro (h-50, r-16), bottoni blu pieni r-26, divider "OPPURE" mono, Google ghost.
  - Icon-button top-left 36px: `✕` (redirect/next → torna a quella URL) o `←` nei passi >1 (torna al passo precedente conservando lo stato).
- **Registrazione a 3 passi**:
  - Passo 1 "I TUOI DATI": nome, email, username (verifica esistente), data di nascita (3 select, hint 16 anni).
  - Passo 2 "LA TUA PASSWORD": pw + conferma + checklist viva basata su `PASSWORD_POLICY`. Avanti disabilitato finché tutti checks + match. Salvo `password` in stato locale, **non** chiamo signup ancora.
  - Passo 3 "LE REGOLE DEL PATTO": card 1 con 2 caselle obbligatorie (Termini/Privacy) + link, card 2 con toggle Mappa Cognitiva + Annunci. Bottone "Crea il tuo account" disabilitato finché entrambe le obbligatorie non spuntate. Al click: 
    1. `useUpsertConsents` con i 4 flag,
    2. cognitive_tracking e ads via `useCognitiveTracking` + `useToggleAdsPersonalization` dopo che l'utente è stato creato,
    3. poi `signUpStep1` (invio OTP).
  - **OTP step**: restyle Anton "VERIFICA LA TUA EMAIL." + input OTP esistente.
  - **Avatar step**: restyle stessa veste, logica invariata.
- **Login**: stessa veste ("ACCEDI A NOPARROT.").
- `AuthPage` legge sia `redirect` che `next` (già mappati precedentemente).

## Report finale
- **A**: file toccati (`AuthPromptSheet.tsx`), esito ✓.
- **B**: elenco file nuovi + toccati, esito ✓; se il gate reale non è stato riutilizzato spiego perché.
- **C**: policy trovata verbatim + metodo di scoperta.
- **D**: risposta alle 4 domande con path:linea per ogni flag, cosa servirebbe per far "fermare" tracking/ads (senza implementarlo).
- `bunx tsgo --noEmit` verde.

## Fuori scope confermato
Feed card, gate reale (logica), overscroll, condivisione: intoccati.

---

**Confermi?** In particolare:
1. Ok a scrivere PRIMA il Blocco C (policy) perché è precondizione del Passo 2 auth.
2. Se il gate reale non è estraibile pulito nel demo, ok a replicare lo stile e segnalarlo?
3. Ordine consenso/signup nel Passo 3: prima creo utente (signUpStep1 → OTP → conferma), POI upserto consensi con user_id reale. Il consenso "pre-utente" resta in `pending_consent` localStorage (già supportato dal hook) e viene syncato dopo auth. Questa è la strada più sicura tecnicamente — brief dice "il consenso precede la chiamata a signUpStep1" ma senza user_id la row user_consents non può essere scritta. Confermi il compromesso: consensi salvati in localStorage al Passo 3, poi `syncPendingConsents(userId)` subito dopo `signUpStep1`?
