

# Piano di Cleanup Finale: DROP COLUMN

## Stato Attuale
La scansione del codice conferma:
- ✅ `useComments.ts` - Nessuna dipendenza attiva (solo commento)
- ✅ `types.ts` - Auto-generato, si aggiornerà dopo DROP
- ✅ Migrazioni SQL - File storici, non richiedono modifiche

## Operazione da Eseguire

### Step 1: Eseguire la Migrazione SQL
Comando SQL da eseguire:
```sql
ALTER TABLE public.comments DROP COLUMN user_density_before_comment;
```

Questa operazione:
- Rimuove la colonna obsoleta dalla tabella `comments`
- Elimina definitivamente i dati sensibili dalla tabella pubblica
- I dati sono già stati migrati nella tabella privata `comment_cognitive_metrics`

### Step 2: Verifica Automatica
Dopo l'esecuzione:
- Il file `src/integrations/supabase/types.ts` verrà rigenerato automaticamente
- I tipi TypeScript non includeranno più `user_density_before_comment`
- L'app compilerà senza errori legati al campo rimosso

## Note Importanti
- La migrazione dati è già stata completata nel passaggio precedente
- L'RLS sulla nuova tabella `comment_cognitive_metrics` è attiva
- Il codice frontend già scrive nella nuova tabella

## Risultato Finale
Dopo questo step, l'architettura di sicurezza sarà completa:
- Dati pubblici → `comments` (senza metriche cognitive)
- Dati privati → `comment_cognitive_metrics` (con RLS restrittivo)

