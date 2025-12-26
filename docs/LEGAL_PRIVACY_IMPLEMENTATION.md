# Documentazione Sistema Legal/Privacy/Consent - NoParrot

## Indice
1. [Architettura](#architettura)
2. [Database](#database)
3. [Pagine e Route](#pagine-e-route)
4. [Testi e Contenuti](#testi-e-contenuti)
5. [Flusso Utente](#flusso-utente)

---

## Architettura

### File Creati
| File | Descrizione |
|------|-------------|
| `src/hooks/useUserConsents.ts` | Hook per gestione consents (localStorage + Supabase) |
| `src/pages/ConsentScreen.tsx` | Schermata di consenso pre-login |
| `src/pages/AdsPolicy.tsx` | Pagina "Pubblicità" |
| `src/pages/Transparency.tsx` | Pagina "Trasparenza su AI e fonti" |

### File Modificati
| File | Modifiche |
|------|-----------|
| `src/pages/SettingsPrivacy.tsx` | Aggiunte 3 nuove card + voce Pubblicità |
| `src/pages/PrivacyPolicy.tsx` | Contenuti aggiornati con nuove sezioni |
| `src/pages/TermsOfService.tsx` | Età 13+, versione v1 |
| `src/pages/OnboardingFlow.tsx` | Aggiunto step "consent" |
| `src/pages/Index.tsx` | Check consent prima di auth |
| `src/App.tsx` | Nuove route /consent, /legal/ads, /legal/transparency |
| `src/contexts/AuthContext.tsx` | Sync consents post-auth |
| `src/components/feed/ExternalFocusCard.tsx` | Info dialog Daily Focus |
| `src/components/ui/trust-badge.tsx` | Info dialog Trust Score |

---

## Database

### Tabella: `user_consents`

```sql
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_privacy boolean NOT NULL DEFAULT false,
  ads_personalization_opt_in boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'v1',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  ads_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### RLS Policies
- `Users can view own consents` - SELECT: `auth.uid() = user_id`
- `Users can insert own consents` - INSERT: `auth.uid() = user_id`
- `Users can update own consents` - UPDATE: `auth.uid() = user_id`

### LocalStorage Keys
- `noparrot-consent-completed` - Flag boolean ("true")
- `noparrot-pending-consent` - JSON con consents pre-auth

---

## Pagine e Route

| Route | Pagina | Descrizione |
|-------|--------|-------------|
| `/consent` | ConsentScreen | Schermata consenso pre-login |
| `/settings/privacy` | SettingsPrivacy | Impostazioni e privacy (estesa) |
| `/privacy` | PrivacyPolicy | Privacy Policy |
| `/terms` | TermsOfService | Termini di Servizio |
| `/legal/ads` | AdsPolicy | Pubblicità |
| `/legal/transparency` | Transparency | Trasparenza su AI e fonti |

---

## Testi e Contenuti

### 1. ConsentScreen (`/consent`)

**Posizione:** `src/pages/ConsentScreen.tsx`

#### Titolo
```
Prima di iniziare
```

#### Corpo principale
```
NoParrot ti aiuta a leggere e discutere i contenuti in modo consapevole.
Per farlo, utilizziamo intelligenza artificiale e registriamo alcune interazioni
(per esempio: cosa leggi, cosa commenti o cosa salvi).
```

#### Lista utilizzo dati
```
Usiamo questi dati per:
• personalizzare il feed
• migliorare la qualità delle conversazioni
• rendere più chiari contesti e fonti
```

#### Paragrafo annunci
```
Puoi scegliere se ricevere annunci più pertinenti in base ai tuoi interessi.
Se non dai il consenso, vedrai comunque annunci legati al tema del contenuto che stai visualizzando.
```

#### Checkbox obbligatorio
```
Label: Accetto Termini e Privacy *
Links: Privacy Policy • Termini di Servizio • Come funzionano gli annunci
```

#### Toggle opzionale
```
Label: Consento annunci basati sui miei interessi
Helper: Se disattivato, vedrai solo annunci basati sul contesto del contenuto.
```

#### Button
```
Continua
```

---

### 2. SettingsPrivacy (`/settings/privacy`)

**Posizione:** `src/pages/SettingsPrivacy.tsx`

#### Card: Il tuo profilo cognitivo
```
Titolo: Il tuo profilo cognitivo
Icona: Brain (viola)

Corpo:
NoParrot costruisce una mappa dei tuoi interessi in base alle tue interazioni 
consapevoli (letture, commenti, condivisioni). Serve solo a migliorare la tua 
esperienza dentro NoParrot.

CTA: Visualizza la mia mappa → /profile#nebulosa
```

#### Card: Annunci
```
Titolo: Annunci
Icona: Megaphone (arancione)

Corpo:
Gli annunci su NoParrot sono mostrati in base al tema dei contenuti che leggi.
Puoi scegliere se riceverne di più pertinenti in base ai tuoi interessi.

Toggle Label: Annunci basati sui miei interessi
Toggle Helper: Se disattivato, vedrai solo annunci legati al tema della conversazione.

Nota: Puoi cambiare idea in qualsiasi momento.
```

#### Card: Trasparenza su AI e fonti
```
Titolo: Trasparenza su AI e fonti
Icona: Sparkles (blu)

Corpo:
Come generiamo "Il Punto", come funziona il Trust Score e cosa significa il percorso di comprensione.

CTA: Apri → /legal/transparency
```

#### Card: Documenti legali (aggiornata)
```
Voci:
- Privacy Policy → /privacy
- Termini di Servizio → /terms
- Pubblicità → /legal/ads (NUOVA)
```

---

### 3. Privacy Policy (`/privacy`)

**Posizione:** `src/pages/PrivacyPolicy.tsx`

#### Header
```
Titolo: Privacy Policy
Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
```

#### Sezione 1: Dati che raccogliamo
```
• Dati account: email, username, data di nascita, avatar (opzionale).
• Dati tecnici: log di sicurezza, dispositivo, preferenze notifiche.
• Dati di interazione: letture, commenti, salvataggi, reazioni — per personalizzare l'esperienza.
```

#### Sezione 2: Cognitive Density
```
La Cognitive Density è una mappa dei tuoi interessi costruita dalle tue interazioni consapevoli. 
Serve solo a personalizzare e migliorare l'esperienza in NoParrot. Non viene condivisa con terzi.
```

#### Sezione 3: Uso dell'intelligenza artificiale
```
I tuoi contenuti possono essere elaborati dall'AI per funzionalità dell'app 
(sintesi, classificazione, domande del percorso di comprensione).

I tuoi dati non vengono utilizzati per addestrare modelli di terze parti, salvo consenso esplicito.
```

#### Sezione 4: I tuoi controlli
```
Puoi gestire le tue preferenze e le impostazioni relative agli annunci 
dalla sezione Impostazioni e privacy.
```

#### Sezione 5: Contatti
```
Titolare del trattamento: Arcangelo Izzo
Email: support@noparrot.app
```

---

### 4. Termini di Servizio (`/terms`)

**Posizione:** `src/pages/TermsOfService.tsx`

#### Header
```
Titolo: Termini di Servizio
Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
```

#### Contenuti (punti chiave modificati)
```
1. Cos'è NoParrot
NoParrot è una piattaforma che consente agli utenti di leggere, condividere e discutere contenuti.

2. Cosa non siamo
NoParrot non è un giornale, una testata né un servizio di fact-checking. 
I contenuti generati dall'intelligenza artificiale sono sintesi automatiche e possono contenere errori.

3. Responsabilità degli utenti
Ogni utente è responsabile dei contenuti che pubblica. 
NoParrot può rimuovere contenuti che violano la legge o i presenti termini.

4. Età minima
Per utilizzare NoParrot devi avere almeno 13 anni.

5. Contenuti esterni
Le anteprime e i contenuti provenienti da fonti esterne restano di proprietà dei rispettivi titolari.
NoParrot non rivendica alcun diritto su tali contenuti.

6. Proprietà intellettuale
I contenuti originali pubblicati dagli utenti rimangono di loro proprietà. 
Pubblicando su NoParrot, l'utente concede una licenza non esclusiva per la visualizzazione 
e distribuzione all'interno della piattaforma.

7. Modifiche ai termini
NoParrot si riserva il diritto di modificare questi termini. 
Gli utenti saranno informati delle modifiche significative.
```

---

### 5. Pubblicità (`/legal/ads`)

**Posizione:** `src/pages/AdsPolicy.tsx`

#### Header
```
Titolo: Pubblicità
Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
```

#### Introduzione
```
In NoParrot gli annunci seguono tre principi:
```

#### Box 1: Contextual first
```
🎯 Contextual first
Gli annunci possono essere mostrati in base al tema del contenuto visualizzato 
(categoria o argomento). Questo approccio non richiede dati personali.
```

#### Box 2: Persona second
```
👤 Persona second
Possiamo migliorare la pertinenza senza usare dati sensibili, 
con logiche non invasive e aggregate.
```

#### Box 3: Cognitivo solo con consenso
```
🧠 Cognitivo solo con consenso
Se attivi "Annunci basati sui miei interessi", useremo anche la tua 
mappa di interessi per mostrarti annunci più rilevanti.
```

#### Footer
```
Puoi attivare o disattivare la personalizzazione in qualsiasi momento 
dalle Impostazioni e privacy.

NoParrot non vende dati personali.
```

---

### 6. Trasparenza (`/legal/transparency`)

**Posizione:** `src/pages/Transparency.tsx`

#### Header
```
Titolo: Trasparenza su AI e fonti
Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
```

#### Sezione: Contenuti AI
```
Icona: Sparkles (blu)

Alcuni contenuti (es. "Il Punto.") sono sintesi automatiche generate 
da sistemi di intelligenza artificiale e possono contenere inesattezze, 
omissioni o errori. Invitiamo sempre a consultare le fonti originali.
```

#### Sezione: Trust Score
```
Icona: Shield (verde)

Il Trust Score indica esclusivamente l'affidabilità delle fonti citate, 
non la verità o la qualità del contenuto. 
È calcolato automaticamente e può contenere errori.
```

#### Sezione: Percorso di comprensione
```
Icona: Brain (viola)

Il percorso di comprensione è uno strumento automatico che verifica 
la coerenza delle risposte rispetto a un contenuto, ma 
non garantisce la reale comprensione dell'utente.
```

---

### 7. Dialog Daily Focus (In-Feed)

**Posizione:** `src/components/feed/ExternalFocusCard.tsx`

#### Trigger
```
Icona ℹ️ accanto al badge "DAILY FOCUS"
```

#### Dialog
```
Titolo: Cos'è Il Punto

Corpo:
Questo contenuto è una sintesi automatica generata da NoParrot usando fonti pubbliche.

Serve per offrire un contesto comune da cui partire per la discussione.

Non rappresenta una posizione ufficiale né una verifica dei fatti.
```

---

### 8. Dialog Trust Score (In-Feed)

**Posizione:** `src/components/ui/trust-badge.tsx`

#### Trigger
```
Icona ℹ️ accanto al Trust Score badge
```

#### Dialog
```
Titolo: Trust Score

Corpo:
Il Trust Score indica il livello di affidabilità delle fonti citate, 
non la verità o la qualità del contenuto.

È calcolato automaticamente e può contenere errori.

[Se presenti reasons]:
Perché questo punteggio:
• [lista reasons]

Footer:
Valuta la qualità delle fonti e la coerenza col contenuto. Non è fact-checking.
```

---

## Flusso Utente

### Primo Accesso
```
1. /onboarding (SplashScreen → Slides → Mission)
2. Click "Crea account" o "Accedi"
3. → /consent (ConsentScreen)
4. Accetta Terms & Privacy (obbligatorio)
5. Toggle Ads (opzionale, default OFF)
6. Click "Continua"
7. → /auth (AuthPage)
8. Login/Signup
9. → / (Feed)
```

### Utente Esistente (senza consent)
```
1. Apre app
2. Check: onboarding done? ✓
3. Check: consent done? ✗
4. → ConsentScreen
5. Completa consent
6. → AuthPage
```

### Sync Post-Auth
```
1. User completa login/signup
2. AuthContext rileva evento SIGNED_IN
3. Chiama syncPendingConsents()
4. Legge noparrot-pending-consent da localStorage
5. Upsert in user_consents table
6. Pulisce localStorage
```

---

## Note Tecniche

### Versioning
- Tutti i documenti sono versione `v1`
- Data ultimo aggiornamento: `26 dicembre 2025`

### Età Minima
- Mantenuta a **13 anni** come da implementazione esistente in AuthContext

### Ads Mode Utility
```typescript
// In useUserConsents.ts
export const getAdMode = (consents): "contextual" | "interest" => {
  if (!consents) return "contextual";
  return consents.ads_personalization_opt_in ? "interest" : "contextual";
};
```

---

## Checklist Implementazione

- [x] Tabella user_consents con RLS
- [x] Hook useUserConsents
- [x] ConsentScreen pre-login
- [x] SettingsPrivacy esteso (3 nuove card)
- [x] Privacy Policy aggiornata
- [x] Termini di Servizio aggiornati (13+)
- [x] Pagina Pubblicità
- [x] Pagina Trasparenza
- [x] Info dialog Daily Focus
- [x] Info dialog Trust Score
- [x] Sync consents post-auth
- [x] Route navigation flow
