# NoParrot - Audit Legale, Privacy e Dati

**Versione:** 2.0  
**Data:** 8 gennaio 2026  
**Documento per:** Review AI Esterni / Compliance Check

---

## 1. Executive Summary

NoParrot è un social network con focus sulla comprensione consapevole. Questo audit copre:
- Conformità GDPR (Regolamento UE 2016/679)
- Conformità DSA (Digital Services Act)
- Gestione dati e sicurezza
- Trasparenza AI

**Status complessivo:** ✅ BETA COMPLIANT (con raccomandazioni)

---

## 2. Conformità GDPR

### 2.1 Age Gate (Art. 8 GDPR)

| Requisito | Implementazione | Status |
|-----------|-----------------|--------|
| Età minima 16 anni | Campo `date_of_birth` NOT NULL in `profiles` | ✅ |
| Verifica età | Check lato client + database constraint | ✅ |
| Blocco registrazione | Utenti <16 anni non possono creare account | ✅ |

**Codice rilevante:** `src/contexts/AuthContext.tsx`
```typescript
// Age validation during signup
const minAge = 16;
const birthDate = new Date(dateOfBirth);
const age = calculateAge(birthDate);
if (age < minAge) {
  throw new Error("Devi avere almeno 16 anni per registrarti");
}
```

### 2.2 Base Giuridica (Art. 6 GDPR)

| Trattamento | Base Giuridica | Documentazione |
|-------------|----------------|----------------|
| Account & servizio | Esecuzione contratto (6.1.b) | ✅ Terms of Service |
| Sicurezza & anti-spam | Interesse legittimo (6.1.f) | ✅ Privacy Policy §2 |
| Cognitive Density | Consenso esplicito (6.1.a) | ✅ Opt-in toggle |
| Ads personalizzati | Consenso esplicito (6.1.a) | ✅ Opt-in toggle |

### 2.3 Consenso (Art. 7 GDPR)

**Implementazione:**
- Schermata `ConsentScreen` pre-autenticazione
- Checkbox obbligatori per Terms + Privacy
- Toggle opzionale per Ads personalizzati (default OFF)
- Versionamento consensi: `consent_version = '2.0'`

**Tabella `user_consents`:**
```sql
accepted_terms              BOOLEAN     -- Obbligatorio
accepted_privacy            BOOLEAN     -- Obbligatorio  
ads_personalization_opt_in  BOOLEAN     -- Opzionale, default false
consent_version             TEXT        -- '2.0'
terms_accepted_at           TIMESTAMPTZ -- Timestamp accettazione
privacy_accepted_at         TIMESTAMPTZ
ads_opt_in_at               TIMESTAMPTZ
```

**Flusso:**
1. Pre-auth: consensi salvati in localStorage
2. Post-auth: sync automatico in `user_consents` table
3. Revoca: disponibile in Impostazioni → Privacy

### 2.4 Diritti dell'Interessato (Artt. 15-22 GDPR)

| Diritto | Implementazione | Location |
|---------|-----------------|----------|
| Accesso (Art. 15) | Data export JSON | Impostazioni → Privacy |
| Rettifica (Art. 16) | Edit profilo | Profilo → Modifica |
| Cancellazione (Art. 17) | Delete account | Impostazioni → Privacy |
| Portabilità (Art. 20) | Export edge function | `export-user-data` |
| Opposizione (Art. 21) | Toggle cognitive tracking | Impostazioni → Privacy |

**Rate limiting export:** 60 secondi tra richieste (tabella `export_requests`)

### 2.5 Profilazione (Art. 22 GDPR)

**Cognitive Density:**
- Mappa di interessi costruita da interazioni consapevoli
- NON produce effetti giuridici né decisioni automatizzate significative
- Usata SOLO per suggerire contenuti, non per escludere da servizi
- Opt-out disponibile: `cognitive_tracking_enabled` in `profiles`

**Disclaimer in Privacy Policy:**
> "Questa profilazione non produce effetti giuridici né effetti equivalenti o significativamente rilevanti sull'utente"

### 2.6 Trasferimenti Extra-UE (Artt. 44-49 GDPR)

| Provider | Localizzazione | Meccanismo Legale |
|----------|----------------|-------------------|
| Supabase | AWS us-east-1 (USA) | SCCs + DPF |
| Google (Gemini) | USA | DPF |
| Lovable | EU/USA | DPF |
| Firecrawl | USA | SCCs |

**Documentazione:** Privacy Policy §3

---

## 3. Conformità DSA (Digital Services Act)

### 3.1 Trasparenza Algoritmica (Art. 27 DSA)

**Implementazione:**
- Pagina `/legal/transparency` con spiegazione algoritmi
- Info dialog su Trust Score (cosa significa, come calcolato)
- Info dialog su Il Punto (sintesi AI, disclaimer)

**Contenuti trasparenza:**
1. Come funziona il feed (cronologico + Il Punto)
2. Come funziona Trust Score (reputazione fonte, non fact-check)
3. Come funziona Comprehension Gate (quiz AI pre-condivisione)

### 3.2 Moderazione Contenuti (Art. 14 DSA)

- Terms of Service chiari su contenuti vietati
- Meccanismo di rimozione contenuti offensivi/illegali
- Nessun sistema automatico di moderazione (manuale)

### 3.3 Punti di Contatto (Art. 12 DSA)

**Email ufficiale:** noparrot.info@gmail.com
**Documentato in:** Privacy Policy, Terms of Service

---

## 4. Dati Raccolti e Conservazione

### 4.1 Categorie Dati

| Categoria | Dati Specifici | Retention |
|-----------|----------------|-----------|
| Account | email, username, DOB, avatar | Fino a cancellazione account |
| Attività | post, commenti, reazioni, salvataggi | Fino a cancellazione account |
| Cognitivi | cognitive_density (mappa interessi) | Fino a cancellazione o opt-out |
| Tecnici | IP (in auth logs), sessioni, push tokens | Supabase default (auth logs) |
| Gate | risposte quiz, punteggi, tempi | Indefinito (analytics) |
| Cache | trascrizioni, trust scores, contenuti | 7-30 giorni (auto-expire) |

### 4.2 Tabelle con Dati Personali

| Tabella | Dati Personali | RLS |
|---------|----------------|-----|
| profiles | username, full_name, bio, avatar, DOB | ✅ Own read/write |
| posts | content (UGC) | ✅ Public read, own write |
| comments | content (UGC) | ✅ Public read, own write |
| messages | content (private) | ✅ Thread participant only |
| user_consents | consensi, timestamps | ✅ Own only |
| notifications | activity references | ✅ Own only |
| post_gate_attempts | risposte quiz, scores | ✅ Own only |

### 4.3 Tabelle NON Personali (Cache/System)

| Tabella | Contenuto | RLS | Note |
|---------|-----------|-----|------|
| daily_focus | Sintesi editoriali | No (public) | Contenuto AI-generated |
| trust_scores | Score per URL | ✅ Auth read | No dati utente |
| content_cache | Articoli estratti | ❌ Disabled | Service role only |
| youtube_transcripts_cache | Trascrizioni | ✅ Insert only | Service role only |

---

## 5. Sicurezza Dati

### 5.1 Row Level Security (RLS)

**Tabelle CRITICHE con RLS attivo:**

```sql
-- profiles: solo proprietario può modificare
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT USING (auth.uid() = id);

-- posts: lettura pubblica, scrittura proprietario
CREATE POLICY "Users can create own posts" 
ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

-- messages: solo partecipanti thread
CREATE POLICY "Thread participants can view messages"
ON messages FOR SELECT 
USING (user_is_thread_participant(thread_id, auth.uid()));

-- post_qa_answers: NESSUNA policy = service role only
-- (Tabella con risposte corrette mai accessibile da client)
```

### 5.2 Gate Security (Quiz/Answers)

**Architettura hardened:**
1. `post_qa_questions` - Domande visibili, NO correctId
2. `post_qa_answers` - Risposte corrette, 0 policies RLS
3. `qa_submit_attempts` - Rate limiting, 0 policies RLS

**Validazione SOLO server-side:**
- Edge function `submit-qa` è l'unica fonte di verità
- Client NON riceve mai risposte corrette
- Rate limit: 10 tentativi / 5 minuti

### 5.3 Messaggi Privati

- Crittografia TLS in transito
- Soft-delete via `message_deletions` table
- NON inviati a sistemi AI
- Policy RLS: solo partecipanti thread

---

## 6. Uso dell'AI

### 6.1 Provider e Modelli

| Provider | Modello | Uso | Data Retention |
|----------|---------|-----|----------------|
| Lovable AI Gateway | gemini-2.5-flash | Quiz, classificazione | No retention |
| Lovable AI Gateway | gemini-2.5-pro | Il Punto sintesi | No retention |

### 6.2 Dati Inviati all'AI

| Funzione | Dati Inviati | Dati Utente |
|----------|--------------|-------------|
| generate-qa | Contenuto fonte (articolo/video) | NO |
| fetch-daily-focus | Titoli notizie pubbliche | NO |
| classify-content | Testo post | Solo testo, no metadata |
| evaluate-trust-score | URL pubblico | NO |

### 6.3 Garanzie AI

✅ Dati NON usati per training modelli terzi
✅ Dati NON conservati da provider AI
✅ Messaggi privati MAI inviati ad AI
✅ Contenuti generati marcati come AI (Il Punto)

---

## 7. Cookie e Tracking

### 7.1 Cookie Utilizzati

| Cookie | Tipo | Scopo | Durata |
|--------|------|-------|--------|
| sb-*-auth-token | Tecnico | Autenticazione Supabase | Sessione |
| noparrot-consent-completed | Tecnico | Flag consenso | Permanente |
| noparrot-pending-consent | Tecnico | Consenso pre-auth | Temporaneo |

### 7.2 Tracking di Terze Parti

❌ **Nessun tracking di terze parti implementato**
❌ Nessun Google Analytics
❌ Nessun Facebook Pixel
❌ Nessun advertising SDK

---

## 8. Documenti Legali

### 8.1 Privacy Policy (`/privacy`)
- Versione: 2.0 (8 gennaio 2026)
- Titolare: Arcangelo Izzo
- Contatto: noparrot.info@gmail.com
- Sezioni: 11 (titolare, base, trasferimenti, età, raccolta, profilazione, messaggi, conservazione, AI, terze parti, diritti)

### 8.2 Terms of Service (`/terms`)
- Versione: 2.0 (6 gennaio 2026)
- Età minima: 16 anni
- Sezioni: 7 (scopo, età, contenuti, IP, limitazioni, cancellazione, modifiche)

### 8.3 Cookie Policy (`/cookie`)
- Solo cookie tecnici dichiarati
- Nessun banner cookie (non necessario per cookie tecnici)

### 8.4 Ads Policy (`/legal/ads`)
- Approccio: Contextual first, Persona second, Cognitivo solo con consenso
- NoParrot NON vende dati personali

### 8.5 Transparency (`/legal/transparency`)
- Spiegazione algoritmi feed
- Spiegazione Trust Score
- Spiegazione Comprehension Gate

---

## 9. Checklist Compliance

### GDPR
- [x] Age gate 16+ con verifica
- [x] Consenso esplicito pre-registrazione
- [x] Versionamento consensi
- [x] Opt-out profilazione (cognitive tracking)
- [x] Data export funzionante
- [x] Rate limiting export (60s)
- [x] Cancellazione account disponibile
- [x] Privacy Policy completa
- [x] Contatto DPO/titolare
- [x] Documentazione trasferimenti extra-UE

### DSA
- [x] Pagina trasparenza algoritmi
- [x] Terms of Service chiari
- [x] Punto di contatto indicato
- [x] Info dialog su contenuti AI

### Security
- [x] RLS su tutte le tabelle con dati personali
- [x] Separazione questions/answers quiz
- [x] Rate limiting validazione quiz
- [x] Service role only per tabelle sensibili
- [x] TLS per messaggi privati

---

## 10. Raccomandazioni

### Alta Priorità
1. **Implementare DSAR automatizzato** - Attualmente export manuale via edge function
2. **Audit log accessi** - Tracciare chi accede a cosa per accountability
3. **Backup encryption** - Verificare encryption at rest su Supabase

### Media Priorità
4. **DPO formale** - Considerare nomina per scale-up
5. **DPIA** - Valutazione impatto per profilazione cognitiva
6. **Retention policy automatica** - Cleanup schedulato dati scaduti

### Bassa Priorità
7. **Certificazioni** - ISO 27001 per enterprise
8. **Cookie banner** - Se aggiunti analytics in futuro
9. **Multi-language** - Privacy Policy in inglese per users internazionali

---

## 11. Tabella Riassuntiva Dati

| Dato | Raccolto | Base Giuridica | Retention | Opt-out |
|------|----------|----------------|-----------|---------|
| Email | ✅ | Contratto | Account life | ❌ |
| Username | ✅ | Contratto | Account life | ❌ |
| Data nascita | ✅ | Contratto (age gate) | Account life | ❌ |
| Avatar | ✅ | Contratto | Account life | ❌ |
| Bio | ✅ | Contratto | Account life | ❌ |
| Post | ✅ | Contratto | Account life | Delete singolo |
| Commenti | ✅ | Contratto | Account life | Delete singolo |
| Reazioni | ✅ | Contratto | Account life | Remove singolo |
| Messaggi | ✅ | Contratto | Account life | Soft delete |
| Cognitive Density | ✅ | Consenso | Account life | ✅ Toggle |
| Risposte quiz | ✅ | Interesse legittimo | Indefinito | ❌ |
| Trust scores | ✅ | Interesse legittimo | 7 giorni | ❌ |
| Trascrizioni | ✅ | Interesse legittimo | 30 giorni | ❌ |

---

## 12. Contatti per Audit

**Titolare del trattamento:**
Arcangelo Izzo
Email: noparrot.info@gmail.com

**Supporto tecnico:**
Via email al titolare

---

*Documento generato per supportare review di AI esterni e compliance check. Per domande specifiche contattare il titolare.*
