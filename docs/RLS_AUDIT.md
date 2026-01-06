# RLS Audit Report

**Generated:** 2025-01-06  
**Scope:** Security-sensitive cache and messaging tables

---

## Summary

| Table | RLS Enabled | Policy Count | Risk Level |
|-------|-------------|--------------|------------|
| content_cache | ✅ Yes | 0 | ✅ LOW (service_role only) |
| youtube_transcripts_cache | ✅ Yes | 1 | ⚠️ MEDIUM (INSERT uses `true`) |
| trust_scores | ✅ Yes | 3 | 🔴 HIGH (see migration below) |
| post_qa | ✅ Yes | 3 | 🔴 HIGH (exposes correct_answers) |
| message_deletions | ✅ Yes | 3 | ✅ LOW |

---

## Table: `content_cache`

**Status:** ✅ Secure - No public policies  
**Access:** Only via service_role (edge functions)

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| *(none)* | - | - | - |

---

## Table: `youtube_transcripts_cache`

**Status:** ⚠️ Review needed

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Service role can insert transcripts | INSERT | - | `true` |

**⚠️ Warning:** `WITH CHECK (true)` allows any authenticated or anonymous user to INSERT if they can bypass RLS. Since there's no SELECT policy, data is protected from reads.

---

## Table: `trust_scores`

**Status:** 🔴 REQUIRES MIGRATION

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Authenticated users can view trust scores | SELECT | `true` | - |
| Service role can insert trust scores | INSERT | - | `true` |
| Service role can update trust scores | UPDATE | `true` | - |

**🔴 Critical Issues:**
1. `SELECT USING (true)` for `authenticated` role exposes all trust scores to any logged-in user
2. `INSERT WITH CHECK (true)` and `UPDATE USING (true)` with `{public}` role is overly permissive
3. **Recommendation:** Remove all SELECT policies, access only via `get-trust-score` edge function

---

## Table: `post_qa`

**Status:** 🔴 KNOWN VULNERABILITY

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Edge functions can read post_qa for valid content | SELECT | `(post_id IS NOT NULL) OR (source_url IS NOT NULL)` | - |
| Edge functions can insert post_qa with required fields | INSERT | - | `((post_id IS NOT NULL) OR (source_url IS NOT NULL)) AND (questions IS NOT NULL) AND (correct_answers IS NOT NULL)` |
| Edge functions can update existing post_qa | UPDATE | `(post_id IS NOT NULL) OR (source_url IS NOT NULL)` | `(questions IS NOT NULL) AND (correct_answers IS NOT NULL)` |

**🔴 Critical Issue:** 
- `correct_answers` column is readable by clients via SELECT policy
- This allows users to see answers before completing the comprehension gate
- **Recommendation:** Create a view that excludes `correct_answers` for client access

---

## Table: `message_deletions`

**Status:** ✅ Secure

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Users can view own message deletions | SELECT | `auth.uid() = user_id` | - |
| Users can insert own message deletions | INSERT | - | `auth.uid() = user_id` |
| Users can delete own message deletions | DELETE | `auth.uid() = user_id` | - |

**✅ All policies correctly scoped to user's own data.**

---

## Recommendations

### Immediate Actions Required

1. **trust_scores** - Drop SELECT policy, use only edge function access *(migration pending)*
2. **post_qa** - Create secure view excluding `correct_answers` *(future migration)*

### Policies with `USING (true)` or `WITH CHECK (true)`

These are overly permissive and should be reviewed:

- `youtube_transcripts_cache.Service role can insert transcripts` - INSERT WITH CHECK (true)
- `trust_scores.Authenticated users can view trust scores` - SELECT USING (true) **← CRITICAL**
- `trust_scores.Service role can insert trust scores` - INSERT WITH CHECK (true)
- `trust_scores.Service role can update trust scores` - UPDATE USING (true)

---

## Migration: trust_scores Hardening

```sql
-- Drop the authenticated SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view trust scores" ON public.trust_scores;

-- Optionally restrict INSERT/UPDATE to service_role only by changing roles
-- Currently these use {public} which includes anon - this is safe because
-- anon key cannot insert/update without proper service_role client
```

**Status:** Pending user approval
