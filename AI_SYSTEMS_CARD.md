# AI Systems Card — NoParrot

Documentazione tecnica dei sistemi di Intelligenza Artificiale integrati nella piattaforma NoParrot, in conformità al Regolamento UE 2024/1689 (AI Act).

**Versione:** 1.0  
**Ultimo aggiornamento:** 18 marzo 2026

---

## 1. Architettura Generale

Tutti i sistemi AI di NoParrot operano in modalità **Prompt-based Zero-shot** o **RAG (Retrieval-Augmented Generation)**. Non viene effettuato fine-tuning diretto dei modelli. I dati degli utenti **non vengono utilizzati per l'addestramento** dei modelli AI.

---

## 2. Inventario Sistemi AI

### 2.1 generate-qa (Comprehension Gate)
| Campo | Dettaglio |
|---|---|
| **Provider** | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| **Input** | Testo sorgente, URL, metadati del contenuto |
| **Output** | 3 domande a risposta multipla |
| **Classificazione Rischio** | Rischio Limitato (Art. 50) |
| **Trasparenza** | Disclaimer nel modale quiz: "Le domande e le risposte sono generate automaticamente da un sistema di Intelligenza Artificiale" |
| **Impatto** | Utilizzato per il Comprehension Gate; l'utente può sempre commentare spontaneamente senza superare il quiz |
| **Human Oversight** | Un moderatore può disabilitare il gate su singoli post |

### 2.2 classify-content
| Campo | Dettaglio |
|---|---|
| **Provider** | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| **Input** | Titolo, testo, sintesi del post |
| **Output** | Categoria tematica (es. Diritto, Economia, Tecnologia) |
| **Classificazione Rischio** | Rischio Minimo |
| **Impatto** | Nessun impatto diretto sull'utente; classificazione interna per feed e clustering |

### 2.3 Trust Score
| Campo | Dettaglio |
|---|---|
| **Provider** | Google Gemini 2.5 Flash Lite |
| **Input** | URL sorgente, testo del post, username autore |
| **Output** | Score (0-100), fascia (BASSO/MEDIO/ALTO), motivazioni |
| **Classificazione Rischio** | Rischio Limitato (Art. 50) |
| **Trasparenza** | Badge visibile con tooltip esplicativo; disclaimer "non è fact-checking" |
| **Human Oversight** | Un moderatore può correggere trust score errati |

### 2.4 Il Punto (fetch-daily-focus)
| Campo | Dettaglio |
|---|---|
| **Provider** | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| **Input** | URL da diverse fonti, RSS, testate storiche |
| **Output** | Sintesi analitica olistica dell'evento |
| **Classificazione Rischio** | Rischio Limitato (Art. 50) |
| **Trasparenza** | Badge `◉ IL PUNTO` con modale informativo: "Questo contenuto è una sintesi automatica generata da NoParrot [...]" |

### 2.5 Trending Topics (generate-trending-summary)
| Campo | Dettaglio |
|---|---|
| **Provider** | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| **Input** | Discussioni e post della community |
| **Output** | Riassunto conciso dei temi caldi |
| **Classificazione Rischio** | Rischio Minimo |
| **Impatto** | Informativo; mostra le tendenze generali della community |

### 2.6 transcribe-audio
| Campo | Dettaglio |
|---|---|
| **Provider** | Deepgram Nova-2 (it) |
| **Input** | File audio (voice post) |
| **Output** | Trascrizione testuale |
| **Classificazione Rischio** | Rischio Minimo |
| **Impatto** | Permette la lettura dell'audio e la generazione di quiz |

---

## 3. Dataset di Training

**Non applicabile.** L'architettura è esclusivamente Prompt-based Zero-shot o RAG. Non viene effettuato fine-tuning diretto su alcun modello. I prompt sono progettati internamente e non contengono dati personali degli utenti.

---

## 4. Human Oversight

- I moderatori possono intervenire manualmente per correggere o sovrascrivere gli output AI (es. Trust Score errati, classificazioni errate).
- Il Comprehension Gate non blocca completamente l'utente: la funzione commento spontaneo è sempre disponibile senza superare il quiz.
- Le sintesi de "Il Punto" sono editorialmente supervisionate prima della pubblicazione.

---

## 5. Garanzie sui Dati

- I dati degli utenti non sono utilizzati per l'addestramento dei modelli AI.
- I dati non sono conservati dai provider AI oltre il tempo necessario per l'elaborazione della singola richiesta.
- I trasferimenti extra-UE sono regolati da Standard Contractual Clauses (SCC) e/o EU–US Data Privacy Framework.
