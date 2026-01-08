# NoParrot - Data Protection Impact Assessment (DPIA Light)

**Versione:** 1.0  
**Data:** 8 gennaio 2026  
**Documento interno per:** Valutazione impatto sulla protezione dei dati

---

## 1. Descrizione del Trattamento

### 1.1 Nome del Trattamento
**Cognitive Density Profiling** — Profilazione degli interessi dell'utente basata su interazioni consapevoli

### 1.2 Descrizione
NoParrot raccoglie dati sugli interessi dell'utente esclusivamente da interazioni che hanno superato il "Comprehension Gate" (quiz di comprensione). Questi dati vengono aggregati in una "mappa cognitiva" visualizzata come Nebulosa.

### 1.3 Categorie di Dati Trattati
| Dato | Descrizione | Sensibilità |
|------|-------------|-------------|
| Categorie tematiche | Società, Economia, Tecnologia, Cultura, Politica, Scienza | Bassa |
| Pesi per categoria | Percentuale di interesse per ogni categoria (0-100%) | Bassa |
| Timestamp interazioni | Data/ora delle interazioni post-gate | Bassa |

### 1.4 Interessati
- Utenti registrati della piattaforma NoParrot (età ≥16 anni)
- Stima: <10.000 utenti in fase beta

### 1.5 Finalità del Trattamento
1. Personalizzazione del feed di contenuti
2. Suggerimento di contenuti rilevanti
3. Visualizzazione Nebulosa per l'utente stesso

---

## 2. Base Giuridica

### 2.1 Consenso Esplicito (Art. 6.1.a GDPR)
- **Meccanismo:** Toggle opt-in in ConsentScreen
- **Default:** OFF (disattivato)
- **Revoca:** In qualsiasi momento tramite Impostazioni → Privacy
- **Versionamento:** Timestamp consenso registrato in `user_consents`

### 2.2 Documentazione Consenso
```sql
-- profiles table
cognitive_tracking_enabled BOOLEAN -- Set da toggle ConsentScreen

-- localStorage (pre-auth)
noparrot-pending-cognitive-opt-in: boolean
```

---

## 3. Valutazione Necessità e Proporzionalità

### 3.1 Necessità
| Domanda | Risposta |
|---------|----------|
| Il trattamento è necessario per la finalità? | Sì, per personalizzare il feed |
| Esistono alternative meno invasive? | Feed non personalizzato disponibile (opt-out) |
| I dati sono minimizzati? | Sì, solo categorie aggregate, no dati granulari |

### 3.2 Proporzionalità
| Fattore | Valutazione |
|---------|-------------|
| Volume dati | Minimo (6 categorie con pesi %) |
| Retention | Fino a cancellazione account o opt-out |
| Condivisione terzi | ❌ MAI |
| Vendita dati | ❌ MAI |
| Training AI terzi | ❌ MAI |

---

## 4. Valutazione dei Rischi

### 4.1 Rischi Identificati

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Accesso non autorizzato ai dati cognitivi | Bassa | Medio | RLS su `profiles`, solo owner può leggere |
| Inferenze sensibili da pattern | Bassa | Basso | Solo 6 categorie generiche, no dati politici/religiosi diretti |
| Profilazione senza consenso | ⚠️ Media (pre-fix) | Alto | ✅ RISOLTO: Toggle opt-in con default OFF |
| Retention indefinita | ⚠️ Media | Medio | Retention fino a opt-out + cancellazione immediata |
| Uso per decisioni automatizzate | Nulla | Alto | MAI usato per escludere da servizi |

### 4.2 Matrice di Rischio

```
IMPATTO
Alto    |  -  |  -  | [Profilazione senza consenso] ✅ RISOLTO
Medio   | [Retention] | [Accesso non autorizzato] |  -  
Basso   |  -  | [Inferenze] |  -  
        | Bassa | Media | Alta
                PROBABILITÀ
```

---

## 5. Misure di Mitigazione

### 5.1 Misure Tecniche

| Misura | Implementazione | Status |
|--------|-----------------|--------|
| Consenso esplicito | Toggle in ConsentScreen con default OFF | ✅ Implementato |
| RLS protezione dati | Solo owner può leggere `cognitive_density` | ✅ Implementato |
| Opt-out immediato | Toggle in Impostazioni → Privacy | ✅ Implementato |
| Cancellazione dati | Reset `cognitive_density` su opt-out | ✅ Implementato |
| Nessuna condivisione | Dati MAI inviati a terzi | ✅ Architettura |

### 5.2 Misure Organizzative

| Misura | Status |
|--------|--------|
| Privacy Policy chiara | ✅ Sezione dedicata profilazione |
| Trasparenza algoritmi | ✅ Pagina /legal/transparency |
| Contatto DPO/Titolare | ✅ noparrot.info@gmail.com |
| Documentazione interna | ✅ Questo documento |

---

## 6. Diritti degli Interessati

| Diritto | Come esercitarlo |
|---------|------------------|
| Accesso (Art. 15) | Impostazioni → Privacy → Esporta dati |
| Rettifica (Art. 16) | N/A (dati aggregati automatici) |
| Cancellazione (Art. 17) | Impostazioni → Privacy → Disattiva tracking |
| Opposizione (Art. 21) | Toggle cognitive tracking OFF |
| Portabilità (Art. 20) | Export JSON include cognitive_density |

---

## 7. Consultazione DPA

### 7.1 Necessità di Consultazione Preventiva
In base all'Art. 36 GDPR, la consultazione preventiva con l'Autorità è richiesta se il rischio residuo rimane alto dopo le mitigazioni.

**Valutazione:**
- Rischio residuo: **BASSO**
- Consultazione preventiva: **NON RICHIESTA**

**Motivazione:**
1. Dati non sensibili (solo categorie tematiche generiche)
2. Consenso esplicito implementato
3. Opt-out immediato disponibile
4. Nessuna decisione automatizzata
5. Nessuna condivisione con terzi

---

## 8. Conclusioni

### 8.1 Esito Valutazione
✅ **TRATTAMENTO APPROVATO** con misure di mitigazione in atto

### 8.2 Azioni Completate
- [x] Toggle opt-in consenso esplicito in ConsentScreen
- [x] Default cognitive_tracking_enabled = false per nuovi utenti
- [x] Opt-out disponibile in Impostazioni
- [x] RLS su profili per protezione dati
- [x] Documentazione Privacy Policy aggiornata

### 8.3 Revisione
Questo documento deve essere rivisto:
- In caso di modifiche sostanziali al trattamento
- Almeno annualmente
- Prima di scale-up significativo (>100.000 utenti)

---

## 9. Approvazioni

| Ruolo | Nome | Data |
|-------|------|------|
| Titolare trattamento | Arcangelo Izzo | 8 gennaio 2026 |
| Responsabile tecnico | Lovable AI | 8 gennaio 2026 |

---

*Documento interno. Non destinato a distribuzione pubblica.*
