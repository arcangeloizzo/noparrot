# NoParrot — Analisi Costi e Scalabilità

**Data:** 12 febbraio 2026  
**Basato su:** Dati reali di telemetria (46.438 log AI) e dimensioni DB attuali

---

## 1. Stato Attuale (Baseline)

### 1.1 Database

| Metrica | Valore |
|---------|--------|
| Dimensione totale DB | ~18 MB |
| Tabelle | 43 |
| Righe totali (stima) | ~49.000 |
| Tabella più grande | `ai_usage_logs` (10 MB, 46.438 righe) |
| Utenti | ~10 |
| Post | 162 |
| Storage (3 bucket) | < 100 MB |

### 1.2 Chiamate AI (da telemetria reale)

Con ~10 utenti e 162 post, la tabella `ai_usage_logs` ha **46.438 righe**, indicando un uso intensivo dell'AI durante lo sviluppo. In produzione con utenti reali, il pattern sarà diverso.

---

## 2. Costi delle Integrazioni AI

### 2.1 Lovable AI Gateway (Gemini)

Lovable AI ha un free tier incluso + costi basati su crediti. I modelli usati:

| Modello | Uso | Costo stimato per 1000 chiamate |
|---------|-----|--------------------------------|
| `gemini-2.5-flash` | Quiz, Trust Score, classificazione, editoriale | ~$0.15-0.30 (input) + ~$0.60-1.20 (output) |
| `gemini-2.5-flash-image` | Infografiche | ~$0.04/immagine |

**Nota:** Prezzi Gemini Flash (Google, feb 2026):
- Input: $0.15 / 1M token (standard) 
- Output: $0.60 / 1M token (standard)
- Immagini: ~$0.04/immagine generata

### 2.2 Servizi Esterni

| Servizio | Piano | Costo Mensile | Limite |
|---------|-------|--------------|--------|
| **Firecrawl** | Free/Starter | $0 - $19/mese | 500-3000 credits |
| **Supadata** | Free/Pro | $0 - $29/mese | 200-5000 req |
| **Jina AI** | Free tier | $0 | 1M token gratis |
| **Deepgram** | Pay-as-you-go | ~$0.0043/min | — |
| **Spotify API** | Free | $0 | Rate limited |
| **Genius API** | Free | $0 | Rate limited |
| **YouTube Data API** | Free tier | $0 | 10.000 units/giorno |

### 2.3 Hosting (Lovable Cloud / Supabase)

| Componente | Piano Free | Piano Pro |
|-----------|-----------|-----------|
| Database | 500 MB | 8 GB ($25/mese) |
| Auth | 50.000 MAU | 100.000 MAU |
| Storage | 1 GB | 100 GB ($25/mese) |
| Edge Functions | 500K invocazioni | 2M invocazioni ($25/mese) |
| Bandwidth | 5 GB | 250 GB |
| Realtime | 200 connessioni | 500 connessioni |

---

## 3. Proiezioni di Costo per Scenario

### Assunzioni per utente attivo/mese:

| Azione | Frequenza media/utente/mese |
|--------|---------------------------|
| Post pubblicati | 5 |
| Post con URL (trigger pipeline AI) | 3 |
| Tentativi Gate | 8 |
| Commenti | 15 |
| Visualizzazioni feed | 200 |
| Messaggi | 20 |
| Ricerche | 10 |
| Infografiche generate | 0.5 |

### Chiamate AI per utente/mese:

| Funzione AI | Chiamate/utente/mese | Token input medi | Token output medi |
|------------|---------------------|------------------|-------------------|
| generate-qa | 3 | ~1500 | ~800 |
| classify-content | 3 | ~500 | ~200 |
| evaluate-trust-score* | 1.5 | ~400 | ~300 |
| fetch-daily-focus | 0.15 (condiviso) | ~2000 | ~1500 |
| fetch-interest-focus | 0.3 (condiviso) | ~2000 | ~1500 |
| generate-infographic | 0.5 | ~500 | immagine |
| trending-topics | 0.05 (condiviso) | ~1500 | ~1000 |

\* Con Lazy Trust whitelist, ~40% delle fonti skippa la chiamata AI

---

### 3.1 Scenario: 1.000 Utenti Attivi

| Voce | Costo Mensile |
|------|--------------|
| **Lovable Cloud (Pro)** | $25 |
| **Database** | Incluso (stimato ~200 MB) |
| **Storage** | Incluso (stimato ~5 GB) |
| **Edge Functions** | Incluso (~50K invocazioni) |
| **Lovable AI (Gemini Flash)** | ~$5-15 |
| **Gemini Flash Image (infografiche)** | ~$20 (500 immagini) |
| **Firecrawl** | $19 (Starter) |
| **Supadata** | $0-29 |
| **Altri servizi** | $0 (free tiers) |
| **TOTALE** | **~$70-110/mese** |

**✅ La piattaforma regge tranquillamente.** Database sotto 500 MB, Edge Functions sotto il limite Pro.

---

### 3.2 Scenario: 10.000 Utenti Attivi

| Voce | Costo Mensile |
|------|--------------|
| **Lovable Cloud (Pro)** | $25 |
| **Database** | ~2 GB — incluso nel Pro (8 GB) |
| **Storage** | ~50 GB — incluso nel Pro (100 GB) |
| **Edge Functions** | ~500K invocazioni — potrebbe servire upgrade |
| **Bandwidth** | ~100 GB — incluso nel Pro |
| **Realtime** | ~200-500 connessioni simultanee — al limite Pro |
| **Lovable AI (Gemini Flash)** | ~$50-150 |
| **Gemini Flash Image (infografiche)** | ~$200 (5000 immagini) |
| **Firecrawl** | $49-99 (Growth) |
| **Supadata** | $29-79 |
| **Deepgram** | ~$10-20 |
| **TOTALE** | **~$450-650/mese** |

**⚠️ Punti di attenzione:**
- **Edge Functions:** 500K invocazioni/mese potrebbe non bastare. Ogni page load genera multiple chiamate. Budget aggiuntivo ~$25-50.
- **Realtime connections:** Con 10K MAU, le connessioni simultanee ai picchi potrebbero superare 500. Piano Team ($599/mese) potrebbe servire.
- **Costi AI:** L'ottimizzazione del caching diventa critica. Implementare:
  - Cache Redis per Trust Score (evita ricalcoli)
  - Batch processing per editoriale (non real-time)
  - Rate limiting per infografiche (max 3/utente/giorno)

**Piano alternativo più realistico con Supabase Team plan:**

| Voce | Costo Mensile |
|------|--------------|
| **Supabase Team** | $599 |
| **AI (tutto)** | ~$250-350 |
| **Servizi esterni** | ~$80-130 |
| **TOTALE** | **~$930-1.080/mese** |

---

### 3.3 Scenario: 100.000 Utenti Attivi

| Voce | Costo Mensile |
|------|--------------|
| **Supabase Enterprise** | $1.500-5.000 (custom) |
| **Database** | ~20 GB+ — Enterprise necessario |
| **Storage** | ~500 GB+ — Enterprise |
| **Edge Functions** | ~5M+ invocazioni — Enterprise |
| **Bandwidth** | ~1 TB+ — Enterprise |
| **Realtime** | ~2.000-5.000 conn. simultanee |
| **Lovable AI (Gemini Flash)** | ~$500-1.500 |
| **Gemini Flash Image (infografiche)** | ~$2.000 (50K immagini) |
| **Firecrawl** | $249+ (Scale) |
| **Supadata** | $199+ |
| **Deepgram** | ~$100-200 |
| **CDN / Cache layer** | ~$200-500 (necessario) |
| **TOTALE** | **~$5.000-9.000/mese** |

**🔴 Interventi architetturali necessari:**

1. **CDN / Edge caching** per contenuti statici (editoriale, Trust Score)
2. **Redis/Valkey** per caching in-memory (Trust Score, quiz, sessioni)
3. **Background job queue** (BullMQ o simile) per pipeline publish-post
4. **Read replicas** per distribuire il carico DB
5. **Horizontal scaling** Edge Functions (serverless auto-scale, ma monitorare cold starts)
6. **Rate limiting robusto** (non solo per quiz, ma per tutte le chiamate AI)
7. **Sharding** tabella `ai_usage_logs` (crescerà a ~50M righe/mese)
8. **Object storage** separato per media pesanti (S3/R2 invece di Supabase Storage)
9. **Connection pooling** (PgBouncer, già incluso in Supabase Enterprise)

---

## 4. Tabella Comparativa

| | 1K Utenti | 10K Utenti | 100K Utenti |
|--|----------|-----------|-------------|
| **Costo/mese** | ~$70-110 | ~$930-1.080 | ~$5.000-9.000 |
| **Costo/utente/mese** | ~$0.07-0.11 | ~$0.09-0.11 | ~$0.05-0.09 |
| **Piano hosting** | Pro ($25) | Team ($599) | Enterprise |
| **DB size** | ~200 MB | ~2 GB | ~20 GB+ |
| **Storage** | ~5 GB | ~50 GB | ~500 GB+ |
| **AI calls/mese** | ~10K | ~100K | ~1M |
| **Bottleneck** | Nessuno | Realtime, Edge Fn | Tutto — serve re-arch |
| **Sostenibile?** | ✅ Sì | ✅ Con ottimizzazioni | ⚠️ Serve refactoring |

---

## 5. Ottimizzazioni per Ridurre Costi

### 5.1 Quick Wins (Implementabili subito)

| Ottimizzazione | Risparmio stimato | Effort |
|---------------|------------------|--------|
| Aumentare TTL Trust Score da 7 a 14 giorni | -20% chiamate Trust | Basso |
| Batch editoriale (2x/giorno invece che on-demand) | -30% chiamate Focus | Basso |
| Rate limit infografiche (3/utente/giorno) | -50% costi immagini | Basso |
| Compressione immagini media pre-upload | -30% storage | Medio |
| Cleanup automatico `ai_usage_logs` > 90 giorni | Libera ~70% DB | Basso |

### 5.2 Medio Termine (1K-10K utenti)

| Ottimizzazione | Risparmio stimato | Effort |
|---------------|------------------|--------|
| Redis caching layer | -40% chiamate AI | Alto |
| Quiz caching per URL (non solo content_hash) | -25% generate-qa | Medio |
| Lazy loading editoriale (genera solo se visualizzato) | -20% AI | Medio |
| CDN per media statici | -50% bandwidth | Medio |

### 5.3 Lungo Termine (10K-100K utenti)

| Ottimizzazione | Risparmio stimato | Effort |
|---------------|------------------|--------|
| Modello on-premise per Trust Score (fine-tuned) | -80% costi Trust | Molto alto |
| Pre-computed feed (materialized views) | -50% query time | Alto |
| Migrazione storage a S3/R2 | -60% costi storage | Alto |
| Architettura event-driven (pub/sub) | Scalabilità orizzontale | Molto alto |

---

## 6. Break-even Analysis

Assumendo il modello Freemium proposto:

| Metrica | 1K | 10K | 100K |
|---------|-----|------|------|
| **Costo totale/mese** | $90 | $1.000 | $7.000 |
| **Users Pro (10% conv.)** | 100 | 1.000 | 10.000 |
| **Revenue Pro ($4.99)** | $499 | $4.990 | $49.900 |
| **Revenue Ads ($0.50 CPM)** | ~$50 | ~$500 | ~$5.000 |
| **Revenue totale** | $549 | $5.490 | $54.900 |
| **Margine** | +$459 | +$4.490 | +$47.900 |
| **Break-even** | ~18 Pro users | ~200 Pro users | ~1.400 Pro users |

**Il modello è sostenibile a tutti e tre gli scenari** con una conversion rate Pro del 10% e un prezzo di $4.99/mese.

---

## 7. Rischi Finanziari

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Aumento prezzi Gemini | Media | Alto | Multi-model (fallback OpenAI), caching |
| Abuso AI (spam quiz/infografiche) | Alta | Medio | Rate limiting, CAPTCHA |
| Storage explosion (media) | Media | Alto | Compressione, cleanup, limiti upload |
| Lovable Cloud pricing change | Bassa | Alto | Architettura portabile (Supabase standard) |
| Cold starts Edge Functions | Media | Basso | Keep-alive, caching |

---

## 8. Raccomandazioni

### Per 1K utenti (attuale obiettivo)

1. ✅ **Nessun cambiamento architetturale necessario**
2. ✅ Piano Pro Supabase ($25/mese) è sufficiente
3. ⚡ Implementare cleanup `ai_usage_logs` (quick win)
4. ⚡ Rate limiting infografiche

### Per 10K utenti (6-12 mesi)

1. 🔄 Migrare a Supabase Team plan
2. 🔧 Implementare Redis caching
3. 🔧 CDN per media
4. 📊 Dashboard costi real-time

### Per 100K utenti (12-24 mesi)

1. 🏗️ Re-architettura: microservizi, event-driven
2. 🏗️ Storage dedicato (S3/R2)
3. 🏗️ Read replicas e connection pooling
4. 💰 Fundraising o revenue sufficiente per Enterprise hosting

---

*Analisi interna. Stime basate su prezzi pubblici (feb 2026) e pattern d'uso osservati. Soggette a variazione.*
