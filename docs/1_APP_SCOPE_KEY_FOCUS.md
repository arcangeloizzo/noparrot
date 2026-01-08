# NoParrot - Scopo dell'App e Key Focus

**Versione:** 2.1  
**Data:** 8 gennaio 2026  
**Documento per:** Onboarding AI Esterni

---

## 1. Identità del Prodotto

### Nome
**NOPARROT** - Social Anti-Echo-Chamber

### Claim
> "Read. Understand. Then share."  
> "Leggi. Comprendi. Poi condividi."

### Tagline
Un social network che premia la comprensione consapevole, non lo scroll compulsivo.

---

## 2. Mission e Vision

### Mission
Trasformare lo scrolling passivo in comprensione attiva, creando una piattaforma dove la qualità del pensiero prevale sulla quantità delle interazioni.

### Vision
Un ecosistema informativo dove:
- La condivisione richiede comprensione dimostrabile
- Le echo chamber sono attivamente contrastate
- La trasparenza sulle fonti è nativa, non opzionale
- L'AI serve l'utente, non lo manipola

---

## 3. Key Focus (Pilastri Fondamentali)

### 🧠 Pillar 1: Comprehension Gate
**"Prima capisci, poi condividi"**

Prima di condividere o commentare "consapevolmente" un contenuto, l'utente deve superare un breve quiz (3 domande) generato dall'AI.

**Meccanismo:**
- Quiz con 3 domande a risposta multipla
- Validazione esclusivamente server-side (`submit-qa` edge function)
- **Block-on-wrong:** dopo 2 errori totali, il quiz è fallito
- Nessuna esposizione delle risposte corrette al client

**Modalità di test (basate sulla lunghezza del testo utente):**
- `≤30 parole`: `SOURCE_ONLY` (3 domande sulla fonte)
- `31-120 parole`: `MIXED` (1 su testo utente, 2 su fonte)
- `>120 parole`: `USER_ONLY` (3 domande sul testo utente)

**Configurazione tecnica:**
- Modalità: `guardrail` (attrito soft, non blocco hard)
- Architettura: `post_qa_questions` (domande) + `post_qa_answers` (risposte, RLS service_role only)
- Rate limiting: gestito a livello edge function con `qa_submit_attempts`

### ⚖️ Pillar 2: Trust Score
**"Valuta la fonte, non solo il contenuto"**

- Score automatico sull'affidabilità della FONTE (non del contenuto)
- Basato su: reputazione dominio, trasparenza editoriale, storico verificabilità
- Visualizzazione: badge colorato con prefisso "Fonte:" (Basso/Medio/Alto) e tooltip esplicativo
- Disclaimer chiaro: "Non è fact-checking"

**Livelli:**
- 🔴 Fonte: Basso — Fonte con storico problematico o non trasparente
- 🟡 Fonte: Medio — Fonte generalmente affidabile ma con limitazioni
- 🟢 Fonte: Alto — Fonte con alta reputazione e trasparenza editoriale

### ◉ Pillar 3: Il Punto (Daily Focus)
**"Sintesi editoriale AI per un contesto comune"**

- Sintesi giornaliere generate da AI con contenuto editoriale (1500-2000 caratteri)
- Identità editoriale distinta: "◉ IL PUNTO" con @ilpunto
- Fonti multiple aggregate con link alle fonti originali
- Deduplicazione intelligente per evitare ripetizioni
- Deep content per approfondimenti

**Nota importante:** Non facciamo reporting giornalistico. Generiamo sintesi e contestualizzazione AI da fonti terze, chiaramente etichettate.

**Caratteristiche:**
- Carosello immersivo nel feed
- Nessuna posizione editoriale: analisi strutturale, non giudizio
- Stile: "lucido, distaccato, strutturale"
- Titoli max 60 caratteri, formato analitico

### 🌐 Pillar 4: Cognitive Identity (Nebulosa)
**"Ciò che capisci ti plasma"**

- Mappa visiva degli interessi dell'utente
- Costruita solo da interazioni consapevoli (post-gate)
- Categorie: Società, Economia, Tecnologia, Cultura, Politica, Scienza
- **Consenso esplicito richiesto:** toggle opt-in in ConsentScreen
- Opt-out disponibile in qualsiasi momento nelle Impostazioni
- I dati non vengono mai venduti né condivisi con terzi

---

## 4. Anti-Pattern (Cosa NON è NoParrot)

| NON siamo | Perché |
|-----------|--------|
| Un giornale | Non facciamo reporting. Generiamo sintesi AI da fonti terze |
| Fact-checker | Il Trust Score valuta fonti, non verifica fatti |
| Social tradizionale | Niente like-addiction, niente feed infinito manipolato |
| Piattaforma educativa | Non insegniamo, verifichiamo comprensione |

---

## 5. Target User

### Primario
- **Età:** 16-35 anni
- **Profilo:** Consumatori critici di informazione
- **Pain point:** Sovraccarico informativo, sfiducia nei media, echo chamber

### Secondario
- Professionisti della comunicazione
- Educatori digitali
- Ricercatori in media studies

---

## 6. Unique Value Proposition

```
NoParrot è l'unico social network che:
1. RICHIEDE comprensione dimostrata prima della condivisione
2. MOSTRA la reputazione delle fonti in modo trasparente
3. COSTRUISCE un profilo cognitivo (non comportamentale) dell'utente
4. NON USA i dati per addestrare AI di terze parti
```

---

## 7. Metriche di Successo (North Star)

| Metrica | Descrizione | Target |
|---------|-------------|--------|
| Comprehension Rate | % utenti che superano il gate al primo tentativo | >60% |
| Source Engagement | Click su "vedi fonti" / impressions | >15% |
| Conscious Sharing | Condivisioni post-gate / tentativi totali | >80% |
| Cognitive Diversity | Entropia categorie nella nebulosa utente | >0.7 |

---

## 8. Competitive Landscape

| Competitor | Differenziazione NoParrot |
|------------|---------------------------|
| Twitter/X | Gate obbligatorio vs. condivisione istantanea |
| Threads | Focus su comprensione vs. conversazione |
| Substack | Social vs. newsletter |
| Ground News | Community-first vs. aggregatore |

---

## 9. Roadmap Sintetica

### ✅ Beta Attuale (v2.1)
- Comprehension Gate funzionante
- Il Punto giornaliero
- Trust Score automatico
- Cognitive Density tracking (con consenso esplicito)
- Messaggistica privata
- GDPR/DSA compliance

### 🔜 Prossimi Step
- Multicategoria per Il Punto
- Insights editoriali su dibattiti
- Community moderation tools
- Analytics cognitive per utenti

---

## 10. Glossario Rapido

| Termine | Definizione |
|---------|-------------|
| **Comprehension Gate** | Quiz AI (3 domande) che verifica comprensione prima di azioni. Block-on-wrong dopo 2 errori. |
| **Trust Score** | Valutazione automatica affidabilità fonte (non fact-checking) |
| **Il Punto** | Sintesi editoriale giornaliera AI da fonti terze |
| **Cognitive Density** | Mappa interessi costruita da interazioni consapevoli (richiede consenso) |
| **Nebulosa** | Visualizzazione grafica della Cognitive Density |
| **qaId** | Identificatore univoco sessione quiz |

---

*Documento generato per supportare l'onboarding di AI esterni. Per dettagli tecnici vedere `2_TECHNICAL_DOCUMENTATION.md`.*
