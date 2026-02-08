# NoParrot v2.0 — Audit Legale, Privacy e Dati

**Versione:** 2.0  
**Data:** 8 gennaio 2026  
**Stato:** Audit completo post-implementazione

---

## 1. Sommario Compliance

| Area | Status | Note |
|------|--------|------|
| GDPR Art. 5 (Principi) | ✅ Conforme | Minimizzazione, retention definita |
| GDPR Art. 6 (Base giuridica) | ✅ Conforme | Contratto + Consenso dove necessario |
| GDPR Art. 7 (Consenso) | ✅ Conforme | Toggle espliciti, revocabili |
| GDPR Art. 13 (Informativa) | ✅ Conforme | Privacy Policy completa |
| GDPR Art. 15-22 (Diritti) | ✅ Conforme | Export, cancellazione, opposizione |
| GDPR Art. 25 (Privacy by Design) | ✅ Conforme | RLS, zero-knowledge gate |
| GDPR Art. 32 (Sicurezza) | ✅ Conforme | RLS, JWT, service_role isolation |
| DSA Art. 27 (Trasparenza) | ✅ Conforme | Pagina trasparenza AI |
| Età minima (16+) | ✅ Conforme | DOB required, blocco UI |

---

## 2. Raccolta Dati

### 2.1 Dati Raccolti

| Categoria | Dati | Base Giuridica | Retention |
|-----------|------|----------------|-----------|
| Account | email, username, DOB, avatar | Contratto | Vita account |
| Attività | post, commenti, reazioni | Contratto | Vita account |
| Cognitivi | cognitive_density | **Consenso** | Vita account (revocabile) |
| Gate | risposte, tempi, score | Legittimo interesse | **365 giorni** |
| Tecnici | IP (logs), sessioni | Legittimo interesse | 30 giorni (logs) |
| Cache | trascrizioni, articoli | Legittimo interesse | 7-30 giorni |

### 2.2 Minimizzazione

- **PII escluse da view pubbliche**: `public_profiles` esclude `username` (contiene email), `date_of_birth`
- **Messaggi privati**: non inviati a AI, soft-delete disponibile
- **Gate data**: solo metriche aggregate, risposte raw scadono in 365 giorni

---

## 3. Consenso e Opt-In/Opt-Out

### 3.1 ConsentScreen Flow

Prima dell'uso dell'app, l'utente deve:

1. **Accettare Terms + Privacy** (obbligatorio, checkbox)
2. **Toggle Cognitive Tracking** (opzionale, default OFF)
   - Label: "Consento la creazione della mia mappa cognitiva"
3. **Toggle Ads Personalization** (opzionale, default OFF)
   - Label: "Consento annunci basati sui miei interessi"

### 3.2 Storage Consenso

**Utenti autenticati:**
```sql
user_consents (
  accepted_terms, accepted_privacy, 
  ads_personalization_opt_in, consent_version,
  terms_accepted_at, privacy_accepted_at
)
profiles.cognitive_tracking_enabled
```

**Utenti pre-auth:**
- `localStorage: noparrot-pending-consent`
- `localStorage: noparrot-pending-cognitive-opt-in`
- Sincronizzato a DB post-login

### 3.3 Coerenza GDPR

Se `cognitive_tracking_enabled = false`:
- `ads_personalization_opt_in` forzato a `false`
- Nessun aggiornamento `cognitive_density`

### 3.4 Revoca

Disponibile in **Impostazioni → Privacy**:
- Toggle "Tracciamento profilo cognitivo"
- Toggle "Annunci basati sui miei interessi"
- Button "Cancella il mio account"
- Button "Scarica i miei dati"

---

## 4. Age Gate

### 4.1 Implementazione

```typescript
// src/components/auth/AuthPage.tsx
// Riga 465
<p className="text-xs text-muted-foreground">
  Per iscriverti devi avere almeno 16 anni
</p>
```

**Validazione:**
```typescript
// Riga 110-115
const age = new Date().getFullYear() - parseInt(yearOfBirth);
if (age < 16) {
  toast.error("Devi avere almeno 16 anni per iscriverti");
  return;
}
```

### 4.2 Linguaggio Corretto

✅ **Diciamo:** "Per iscriverti devi avere almeno 16 anni"  
✅ **Diciamo:** "Richiediamo la data di nascita per rispettare il limite di età"  
❌ **NON diciamo:** "Verifichiamo la tua età"  
❌ **NON diciamo:** "Verifichiamo la tua identità"

### 4.3 Enforcement

- DOB salvato in `profiles.date_of_birth` (NOT NULL)
- Calcolo età client-side al momento della registrazione
- Blocco creazione account se età < 16

---

## 5. Comprehension Gate — Privacy

### 5.1 Architettura Zero-Knowledge

Il sistema è progettato per non esporre mai le risposte corrette al client:

1. **post_qa_questions** — Contiene solo domande (no `correctId`)
   - RLS: `owner_id = auth.uid()` per SELECT
   - No INSERT/UPDATE/DELETE da client

2. **post_qa_answers** — Contiene risposte corrette
   - RLS: **NESSUNA policy per authenticated** = service_role only
   - Solo Edge Functions possono accedere

3. **submit-qa** — Validazione step-by-step
   - Input: `{ qaId, questionId, choiceId }`
   - Output: `{ isCorrect: boolean }` — MAI la risposta corretta

### 5.2 Retention Gate Data

```sql
-- post_gate_attempts
expires_at TIMESTAMPTZ DEFAULT (now() + interval '365 days')
```

**Cleanup automatico:**
- Edge Function `cleanup-expired-cache` elimina record scaduti
- Invocabile con header `x-admin-token`

### 5.3 Rate Limiting

```sql
qa_submit_attempts (
  user_id, qa_id, attempt_count, window_start
)
-- Max 10 tentativi per 5 minuti per quiz
```

---

## 6. Trust Score — Privacy

### 6.1 Accesso Controllato

- **trust_scores** table: RLS `service_role` only
- **Frontend access**: Solo via `get-trust-score` Edge Function
- **Richiede JWT** valido

### 6.2 Label UI

```typescript
// src/components/ui/trust-badge.tsx
const BAND_LABELS = {
  BASSO: "Fonte: Basso",
  MEDIO: "Fonte: Medio", 
  ALTO: "Fonte: Alto",
};
```

**Importante:** Prefisso "Fonte:" per chiarire che valutiamo la fonte, non il contenuto.

---

## 7. Cache e Retention

### 7.1 Tabelle Cache

| Tabella | TTL | Contenuto | RLS |
|---------|-----|-----------|-----|
| `content_cache` | 7 giorni | Testo articoli estratti | service_role only |
| `youtube_transcripts_cache` | 30 giorni | Trascrizioni video | service_role only |
| `trust_scores` | 7 giorni | Cache valutazioni fonte | service_role only |
| `post_gate_attempts` | 365 giorni | Tentativi quiz | service_role only |

### 7.2 Cleanup

```typescript
// supabase/functions/cleanup-expired-cache/index.ts
// Elimina record dove expires_at < now()
```

---

## 8. Messaggi Privati

### 8.1 Privacy

- **Non inviati a AI** per analisi
- **TLS** per trasmissione
- **Soft-delete** disponibile (`message_deletions` table)

### 8.2 RLS

```sql
-- messages: solo partecipanti al thread
USING (user_is_thread_participant(thread_id, auth.uid()))

-- message_deletions: solo owner
USING (user_id = auth.uid())
```

---

## 9. AI e Dati

### 9.1 Uso AI

| Funzione | Modello | Dati Inviati |
|----------|---------|--------------|
| Quiz generation | Gemini 2.5 Flash | Contenuto fonte (no PII) |
| Trust Score | Gemini 2.5 Flash | URL + metadata fonte |
| Il Punto | Gemini 2.5 Flash | Articoli pubblici aggregati |
| Classificazione | Gemini 2.5 Flash Lite | Titoli news |

### 9.2 Garanzie

- **No training** su dati utente (Lovable AI Gateway policy)
- **No retention** da parte provider AI
- **Zero PII** inviato per quiz (solo contenuto fonte)

---

## 10. Trasferimenti Internazionali

### 10.1 Provider e Localizzazione

| Provider | Ruolo | Localizzazione |
|----------|-------|----------------|
| Supabase (AWS) | Database, Auth | us-east-1 (USA) |
| Lovable | App hosting, AI Gateway | EU/USA |
| Google (Gemini) | AI | USA |
| Firecrawl | Estrazione articoli | USA |
| Jina | Estrazione articoli | Germania |

### 10.2 Meccanismi Legali

- EU-US Data Privacy Framework (dove applicabile)
- Standard Contractual Clauses (SCCs)
- Informativa in Privacy Policy

---

## 11. Diritti Utente (GDPR Art. 15-22)

### 11.1 Implementati

| Diritto | Implementazione |
|---------|-----------------|
| Accesso | Impostazioni → Privacy → Esporta dati |
| Rettifica | Modifica profilo |
| Cancellazione | Impostazioni → Privacy → Cancella account |
| Portabilità | Export JSON completo |
| Opposizione profilazione | Toggle cognitive tracking OFF |

### 11.2 Export Dati

```typescript
// supabase/functions/export-user-data/index.ts
// Rate limit: 1 export ogni 60 secondi
// Output: JSON con profilo, post, commenti, preferenze
```

---

## 12. Documenti Legali Pubblici

| Documento | Route | Aggiornamento |
|-----------|-------|---------------|
| Privacy Policy | `/privacy` | v2.0, 8 gen 2026 |
| Terms of Service | `/terms` | v2.0, 8 gen 2026 |
| Trasparenza AI | `/legal/transparency` | v2.0, 8 gen 2026 |
| Cookie Policy | `/cookies` | v2.0, 8 gen 2026 |
| Ads Policy | `/legal/ads` | v2.0, 8 gen 2026 |

---

## 13. Checklist Finale

- [x] Età minima 16 anni con blocco UI
- [x] DOB obbligatorio, non nullable
- [x] Cognitive tracking opt-in (default OFF)
- [x] Ads opt-in (default OFF)
- [x] Coerenza: tracking OFF → ads OFF
- [x] Gate data retention 365 giorni
- [x] Cache tables service_role only
- [x] Zero-knowledge quiz validation
- [x] Export dati funzionante
- [x] Cancellazione account funzionante
- [x] Trust Score label "Fonte:"
- [x] Privacy Policy aggiornata
- [x] Trasparenza AI documentata
