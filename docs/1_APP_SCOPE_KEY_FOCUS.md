# NoParrot - Scopo dell'App e Key Focus

**Versione:** 2.0  
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

- Prima di condividere o commentare "consapevolmente" un contenuto, l'utente deve superare un breve quiz (3 domande) generato dall'AI
- Il quiz verifica la comprensione del contenuto, non la memorizzazione
- Meccanismo progressivo: lettura guidata → quiz → azione sbloccata
- Nessun bypass: la validazione avviene esclusivamente server-side

**Configurazione tecnica:**
- Modalità: `guardrail` (attrito soft, non blocco hard)
- Unlock threshold: 80% blocchi letti
- Rate limiting: max 10 tentativi ogni 5 minuti

### ⚖️ Pillar 2: Trust Score
**"Valuta la fonte, non solo il contenuto"**

- Score automatico sull'affidabilità della FONTE (non del contenuto)
- Basato su: reputazione dominio, trasparenza editoriale, storico verificabilità
- Visualizzazione: badge colorato (Basso/Medio/Alto) con tooltip esplicativo
- Disclaimer chiaro: "Non è fact-checking"

**Livelli:**
- 🔴 BASSO: Fonte con storico problematico o non trasparente
- 🟡 MEDIO: Fonte generalmente affidabile ma con limitazioni
- 🟢 ALTO: Fonte con alta reputazione e trasparenza editoriale

### ◉ Pillar 3: Il Punto (Daily Focus)
**"Sintesi editoriale AI per un contesto comune"**

- Sintesi giornaliere delle notizie principali generate da AI
- Identità editoriale distinta: "◉ IL PUNTO" con @ilpunto
- Fonti multiple aggregate con link alle fonti originali
- Deduplicazione intelligente per evitare ripetizioni
- Deep content per approfondimenti

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
- Opt-out disponibile: l'utente può disattivare il tracciamento cognitivo
- I dati non vengono mai venduti né condivisi con terzi

---

## 4. Anti-Pattern (Cosa NON è NoParrot)

| NON siamo | Perché |
|-----------|--------|
| Un giornale | Non produciamo contenuti originali, sintetizziamo |
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

### ✅ Beta Attuale (v2.0)
- Comprehension Gate funzionante
- Il Punto giornaliero
- Trust Score automatico
- Cognitive Density tracking
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
| **Comprehension Gate** | Quiz AI che verifica comprensione prima di azioni |
| **Trust Score** | Valutazione automatica affidabilità fonte |
| **Il Punto** | Sintesi editoriale giornaliera AI |
| **Cognitive Density** | Mappa interessi costruita da interazioni consapevoli |
| **Nebulosa** | Visualizzazione grafica della Cognitive Density |
| **Reader Gate** | Sistema progressivo di lettura guidata |
| **qaId** | Identificatore univoco sessione quiz |

---

*Documento generato per supportare l'onboarding di AI esterni. Per dettagli tecnici vedere `2_TECHNICAL_DOCUMENTATION.md`.*
