# NoParrot v2.0 — RLS Audit

**Versione:** 2.0  
**Data:** 8 gennaio 2026  
**Scope:** Audit completo Row Level Security

---

## 1. Sommario Sicurezza

| Categoria | Tabelle | Status |
|-----------|---------|--------|
| Cache Sensibili | content_cache, youtube_transcripts_cache, trust_scores | ✅ service_role only |
| Quiz Risposte | post_qa_answers | ✅ service_role only |
| Gate Attempts | post_gate_attempts, qa_submit_attempts | ✅ service_role only |
| Profili | profiles | ✅ Authenticated + public view |
| Contenuti | posts, comments, reactions | ✅ Public read, auth write |
| Messaggi | messages, message_threads | ✅ Partecipanti only |
| Consensi | user_consents | ✅ Owner only |

---

## 2. Tabelle Critiche — Service Role Only

### 2.1 content_cache

**Contenuto:** Testo estratto da articoli esterni  
**Rischio se esposta:** Scraping massivo, costi AI

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role manages | TO service_role, USING (true) |

**Nessuna policy per anon/authenticated** = accesso bloccato per client.

```sql
ALTER TABLE content_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages content cache"
  ON content_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

### 2.2 youtube_transcripts_cache

**Contenuto:** Trascrizioni video YouTube  
**Rischio se esposta:** Scraping contenuti, violazione ToS YouTube

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role manages | TO service_role, USING (true) |

```sql
ALTER TABLE youtube_transcripts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages transcripts"
  ON youtube_transcripts_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

### 2.3 trust_scores

**Contenuto:** Cache valutazioni reputazione fonti  
**Rischio se esposta:** Manipolazione percezione affidabilità

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role manages | TO service_role, USING (true) |

**Accesso frontend:** Solo via `get-trust-score` Edge Function (JWT required)

```sql
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages trust scores"
  ON trust_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

### 2.4 post_qa_answers

**Contenuto:** Risposte corrette ai quiz  
**Rischio se esposta:** Bypass completo Comprehension Gate

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role manages | TO service_role, USING (true) |
| SELECT | (None for authenticated) | - |

**Zero-Knowledge Architecture:** Client non può mai accedere alle risposte.

```sql
ALTER TABLE post_qa_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages answers"
  ON post_qa_answers FOR ALL TO service_role
  USING (true) WITH CHECK (true);
-- NO policy per authenticated = nessun accesso client
```

---

### 2.5 post_gate_attempts

**Contenuto:** Log tentativi quiz con risposte utente  
**Rischio se esposta:** Leak comportamentale, reverse engineering risposte

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role manages | TO service_role, USING (true) |

**Retention:** 365 giorni (colonna `expires_at`)

---

### 2.6 qa_submit_attempts

**Contenuto:** Rate limiting quiz submissions  
**Rischio se esposta:** Bypass rate limiting

| Operation | Policy | Condition |
|-----------|--------|-----------|
| ALL | Service role only | (implicit, no policies) |

---

## 3. Tabelle Quiz — Owner Access

### 3.1 post_qa_questions

**Contenuto:** Domande quiz (senza risposte corrette)  
**Accesso:** Solo owner può vedere le proprie domande

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Users can read own Q&A | owner_id = auth.uid() |
| INSERT/UPDATE/DELETE | (None) | Solo via Edge Functions |

```sql
ALTER TABLE post_qa_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own Q&A"
  ON post_qa_questions FOR SELECT
  USING (owner_id = auth.uid());
```

---

## 4. Tabelle Utente

### 4.1 profiles

**Contenuto:** Dati profilo utente  
**PII:** username (può essere email), date_of_birth

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Authenticated users view profiles | TO authenticated, USING (true) |
| UPDATE | Users can update own profile | auth.uid() = id |
| INSERT | (Trigger on auth.users) | Automatic |

**View pubblica:** `public_profiles` esclude PII

```sql
CREATE VIEW public_profiles AS
SELECT id, full_name, avatar_url, bio, created_at
FROM profiles;
-- Esclusi: username, date_of_birth
```

---

### 4.2 user_consents

**Contenuto:** Preferenze consenso GDPR

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Own consents | user_id = auth.uid() |
| INSERT | Own consents | user_id = auth.uid() |
| UPDATE | Own consents | user_id = auth.uid() |

---

## 5. Tabelle Contenuti

### 5.1 posts

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public read | USING (true) |
| INSERT | Authenticated create | auth.uid() = author_id |
| UPDATE | Own posts | auth.uid() = author_id |
| DELETE | Own posts | auth.uid() = author_id |

---

### 5.2 comments

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Comments viewable by everyone | USING (true) |
| INSERT | Users can insert own comments | auth.uid() = author_id |
| UPDATE | Own comments | auth.uid() = author_id |
| DELETE | Own comments | auth.uid() = author_id |

---

### 5.3 reactions / comment_reactions

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public read | USING (true) |
| INSERT | Authenticated | auth.uid() = user_id |
| DELETE | Own reactions | auth.uid() = user_id |

---

## 6. Tabelle Messaggi

### 6.1 message_threads

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Participants only | user_is_thread_participant(thread_id, auth.uid()) |

---

### 6.2 messages

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Thread participants | user_is_thread_participant(thread_id, auth.uid()) |
| INSERT | Sender in thread | sender_id = auth.uid() AND user_is_thread_participant(...) |

---

### 6.3 thread_participants

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Own threads | user_is_thread_participant(thread_id, auth.uid()) |

**Security Definer Function:**
```sql
CREATE FUNCTION user_is_thread_participant(check_thread_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM thread_participants 
    WHERE thread_id = check_thread_id AND user_id = check_user_id
  );
$$;
```

---

### 6.4 message_deletions

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Own deletions | user_id = auth.uid() |
| INSERT | Own deletions | user_id = auth.uid() |

---

## 7. Tabelle Focus/Editorial

### 7.1 daily_focus / interest_focus

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public read | USING (true) |
| INSERT/UPDATE/DELETE | Service role only | TO service_role |

---

### 7.2 focus_comments / focus_reactions

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public read | USING (true) |
| INSERT | Authenticated | auth.uid() = author_id/user_id |
| DELETE | Own | auth.uid() = author_id/user_id |

---

## 8. Storage Buckets

### 8.1 avatars

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public | USING (true) |
| INSERT | Own folder | auth.uid()::text = (storage.foldername(name))[1] |
| UPDATE | Own folder | auth.uid()::text = (storage.foldername(name))[1] |
| DELETE | Own folder | auth.uid()::text = (storage.foldername(name))[1] |

### 8.2 news-images

| Operation | Policy | Condition |
|-----------|--------|-----------|
| SELECT | Public | USING (true) |
| INSERT | Service role | TO service_role |

---

## 9. Funzioni Database Critiche

### 9.1 Security Definer Functions

| Function | Purpose | search_path |
|----------|---------|-------------|
| `user_is_thread_participant` | Check partecipazione thread | public |
| `handle_new_user` | Crea profilo su signup | public |
| `create_or_get_thread` | Crea/trova thread messaggi | public |
| `increment_post_shares` | Incrementa contatore shares | public |

Tutte usano `SET search_path TO 'public'` per prevenire SQL injection.

---

## 10. Warning Linter

### 10.1 Permissive RLS Policy

**Status:** WARN  
**Causa:** Alcune policy usano `WITH CHECK (true)` per service_role  
**Mitigazione:** Accettabile per service_role, che è già privilegiato

### 10.2 Leaked Password Protection

**Status:** WARN  
**Azione:** Abilitare in Supabase Auth Settings

---

## 11. Raccomandazioni

### Immediate

1. ✅ Cache tables: solo service_role (implementato)
2. ✅ Quiz answers: zero-knowledge (implementato)
3. ✅ Messaggi: partecipanti only (implementato)
4. ⚠️ Abilitare leaked password protection

### Future

1. Audit periodico policy dopo ogni migrazione
2. Monitoraggio query patterns anomali
3. Review policy su nuove tabelle
