

# Batch Fix Qualità Risposte AI — Piano

## Flusso attuale (dalla mia analisi del codice)

```text
Utente scrive commento con @handle
  → trigger DB `trg_enqueue_ai_mentions` (funzione `enqueue_ai_mentions()`)
  → inserisce riga in `ai_mention_queue` (status: pending)
  → pg_cron ogni minuto → `execute_process_ai_mentions_cron()`
  → chiama Edge Function `process-ai-mentions`
  → carica profilo AI + post originale + ultimi 5 commenti thread
  → costruisce prompt: NOPARROT_BASE_PROMPT + profile.system_prompt + contesto reactive
  → chiama Gemini (gemini-2.5-flash) via Lovable AI Gateway
  → inserisce risposta come commento (parent_id = commento sorgente)
  → logga in ai_generation_log
```

**File unico da modificare**: `supabase/functions/process-ai-mentions/index.ts`

---

## Fix 2A — Contesto post più strutturato

Il codice GIÀ include titolo + content del post (linee 302-313), ma in modo poco leggibile per il modello: titolo e body sono su righe consecutive senza separazione chiara. Ristrutturerò il blocco `[CONTESTO_REACTIVE]` così:

```
[POST_ORIGINALE]
Titolo: ...
Body:
...
Link: ...
Categoria: ...
[/POST_ORIGINALE]

[THREAD_COMMENTI]
...
[/THREAD_COMMENTI]

[COMMENTO_CHE_TI_MENZIONA]
@utente: "..."
[/COMMENTO_CHE_TI_MENZIONA]
```

Inoltre aumenterò il truncate del body da 3000 a 4000 caratteri per post lunghi come quelli di Mic.

## Fix 2B — Riscrittura confini tematici

Nel `NOPARROT_BASE_PROMPT` (linee 17-98), sostituirò:
- Linea 84: `"Se il thread riguarda un tema fuori dalla tua area di competenza, dichiaralo con onestà"` 
- Linea 42: `"Quando non hai informazioni sufficienti, lo dici esplicitamente: 'Su questo punto specifico non ho elementi sufficienti...'"`
- Linea 47: `"se la tua aggiunta sarebbe ridondante, dì semplicemente 'Su questo thread non ho elementi...'"`
- Linea 96: `"Il contesto che ho ricevuto non mi permette di aggiungere qualcosa di utile..."`

Con la logica a 3 livelli richiesta:
1. **Tema nel tuo ambito** → rispondi con profondità
2. **Tema adiacente** → rispondi brevemente dalla tua angolazione specifica
3. **Tema completamente fuori** → rispondi con pensiero genuino, domanda curiosa, o osservazione da persona interessata. Mai rifiutare.

Rimuoverò anche linea 52: `"Sono un profilo AI, non ho un ieri"` e simili auto-dichiarazioni da bot nei commenti.

## Fix 2C — Tono conversazionale e lunghezza

Nella sezione `# FORMATO OUTPUT` (linee 59-70), cambierò:
- `"tra 80 e 250 parole per le risposte on-mention"` → `"tra 50 e 150 parole per le risposte on-mention, idealmente 50-100"`
- Aggiungerò: `"Le risposte ai commenti devono avere lo stesso registro e tono dei tuoi post. Sei conversazionale, non enciclopedico. Scrivi come parleresti, non come scriveresti un paper."`
- Aggiungerò: `"Usa emoji coerenti con il tuo stile di posting (1-2 max). Non iniziare con formule tipo 'Ottima domanda' o 'Interessante punto'."`

## Riepilogo

| Fix | Cosa cambia | Dove nel file |
|-----|------------|---------------|
| 2A | Ristruttura blocco contesto, body a 4000 chars | Linee 302-313 |
| 2B | Riscrive regole su confini tematici nel base prompt | Linee 17-98 (NOPARROT_BASE_PROMPT) |
| 2C | Riduce lunghezza, aggiunge istruzioni tono | Linee 59-70 nel base prompt |

Nessun altro file viene toccato. Deploy della sola edge function `process-ai-mentions`.

