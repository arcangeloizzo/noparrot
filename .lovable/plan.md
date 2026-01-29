
# Piano Fix Sicurezza Database

## Analisi Problemi

| Tabella/View | Problema Attuale | Fix Richiesto |
|-------------|------------------|---------------|
| `reactions` | Policy SELECT aperta a `public` (include anonimi) | Restringere a `authenticated` |
| `media` | Policy SELECT aperta a `public` (include anonimi) | Restringere a `authenticated` |
| `public_profiles` | View SECURITY DEFINER | **Attenzione speciale** - vedi sotto |

## Dettagli Tecnici

### 1. Fix `reactions` - Restringere SELECT a authenticated
```sql
-- Rimuovi policy pubblica esistente
DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.reactions;

-- Crea nuova policy solo per utenti autenticati
CREATE POLICY "Reactions viewable by authenticated"
ON public.reactions
FOR SELECT
TO authenticated
USING (true);
```

### 2. Fix `media` - Restringere SELECT a authenticated
```sql
-- Rimuovi policy pubblica esistente
DROP POLICY IF EXISTS "Media viewable by everyone" ON public.media;

-- Crea nuova policy solo per utenti autenticati
CREATE POLICY "Media viewable by authenticated"
ON public.media
FOR SELECT
TO authenticated
USING (true);
```

### 3. View `public_profiles` - Caso Speciale

La view `public_profiles` è intenzionalmente configurata come SECURITY DEFINER con ownership `postgres`. Questo design è documentato nella memoria di sicurezza del progetto:

> *"User data privacy is enforced by restricting access to the 'profiles' table (RLS: 'auth.uid() = id'). Publicly discoverable information is exposed exclusively through the Security Definer view 'public.public_profiles'."*

**Perché non possiamo cambiarla a SECURITY INVOKER:**
- La tabella `profiles` ha RLS che permette solo `SELECT WHERE auth.uid() = id`
- Se la view usasse SECURITY INVOKER, erediterebbe questa restrizione
- Gli utenti non potrebbero vedere i profili di altri utenti (feed, commenti, notifiche)

**Mitigazioni già presenti:**
- `security_barrier = true` - previene information leakage
- `WHERE auth.uid() IS NOT NULL` - blocca accesso anonimo
- Ownership `postgres` - garantisce il bypass RLS controllato

**Raccomandazione:** Ignorare questo warning del linter, poiché l'architettura è intenzionale e già documentata. In alternativa, aggiungere un commento SQL per documentare la scelta.

## Script SQL Finale

```sql
-- =====================================================
-- Security Fix: Restrict anonymous access to reactions and media
-- =====================================================

-- 1. FIX REACTIONS TABLE
-- Remove public SELECT policy
DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.reactions;

-- Create authenticated-only SELECT policy
CREATE POLICY "Reactions viewable by authenticated"
ON public.reactions
FOR SELECT
TO authenticated
USING (true);

-- 2. FIX MEDIA TABLE
-- Remove public SELECT policy
DROP POLICY IF EXISTS "Media viewable by everyone" ON public.media;

-- Create authenticated-only SELECT policy  
CREATE POLICY "Media viewable by authenticated"
ON public.media
FOR SELECT
TO authenticated
USING (true);

-- 3. PUBLIC_PROFILES VIEW - DOCUMENTED EXCEPTION
-- This view intentionally uses SECURITY DEFINER to bypass profiles RLS
-- and expose only safe public fields. The WHERE auth.uid() IS NOT NULL
-- clause already blocks anonymous access. This is by design.
COMMENT ON VIEW public.public_profiles IS 
  'SECURITY DEFINER by design: bypasses profiles RLS to expose safe public data. 
   Anonymous access blocked via auth.uid() check. See security memory: profiles-privacy-architecture-v5-stable';
```

## Impatto

| Componente | Prima | Dopo |
|-----------|-------|------|
| `reactions` | Anonimi possono leggere | Solo authenticated |
| `media` | Anonimi possono leggere | Solo authenticated |
| `public_profiles` | SECURITY DEFINER | Invariato (documentato) |

## Verifica Post-Applicazione
- L'app funziona normalmente per utenti loggati
- Utenti anonimi non possono accedere a reactions/media
- Feed, commenti e notifiche continuano a mostrare profili correttamente
