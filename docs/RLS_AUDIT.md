# RLS (Row Level Security) Audit Report
## Security-Sensitive Tables - Comprehensive Review

**Generated:** 2026-01-06  
**Version:** 2.0 - Post-hardening

---

## Summary

| Table | RLS Status | Policy Count | Risk Level |
|-------|------------|--------------|------------|
| `post_qa_questions` | ✅ Enabled | 1 | 🟢 LOW |
| `post_qa_answers` | ✅ Enabled | 0 (service_role only) | 🟢 SECURE |
| `qa_submit_attempts` | ✅ Enabled | 0 (service_role only) | 🟢 SECURE |
| `post_qa` (legacy) | ✅ Enabled | 1 (blocked) | 🟢 MITIGATED |
| `content_cache` | ⚠️ Disabled | 0 | 🟡 MEDIUM |
| `youtube_transcripts_cache` | ✅ Enabled | 1 | 🟢 LOW |
| `trust_scores` | ✅ Enabled | 2 | 🟢 SECURE |
| `message_deletions` | ✅ Enabled | 3 | 🟢 LOW |

---

## Attack Surface: MITIGATED ✅

### Comprehension Gate Security

**Before hardening:**
- ❌ `correct_answers` exposed via SELECT policy on `post_qa`
- ❌ Users could see answers before completing the gate
- ❌ No rate limiting on validation attempts

**After hardening:**
- ✅ Questions and answers split into separate tables
- ✅ `post_qa_answers` has NO client policies (service_role only)
- ✅ `post_qa_questions` restricted to owner_id = auth.uid()
- ✅ Rate limiting: max 10 attempts per 5 minutes per Q&A
- ✅ All validation happens server-side via `submit-qa` edge function
- ✅ `get-qa` edge function strips `correctId` before returning questions
- ✅ Expired Q&A rejected with 410 Gone

---

## Detailed Table Audits

### 1. post_qa_questions (NEW - Secure)

**Status:** 🟢 SECURE

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Users can read own Q&A | SELECT | `owner_id = auth.uid()` | - |

**Security notes:**
- No INSERT/UPDATE/DELETE policies - all writes via edge functions
- Owner-based access control
- `correctId` stripped by edge function before returning to client
- Expires automatically (30 days default)

---

### 2. post_qa_answers (NEW - Secure)

**Status:** 🟢 FULLY SECURE

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| (none) | - | - | - |

**Security notes:**
- RLS enabled with ZERO policies = no client access whatsoever
- Only service_role (edge functions) can read/write
- Contains ONLY `correct_answers` - never exposed to client
- Foreign key cascade delete with `post_qa_questions`

---

### 3. qa_submit_attempts (NEW - Rate Limiting)

**Status:** 🟢 SECURE

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| (none) | - | - | - |

**Security notes:**
- RLS enabled with ZERO policies = service_role only
- Tracks rate limiting: user_id + qa_id + attempt_count
- Window-based rate limiting (5 minutes, max 10 attempts)

---

### 4. post_qa (LEGACY - Blocked)

**Status:** 🟢 MITIGATED

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| No client access to legacy post_qa | SELECT | `false` | - |

**Security notes:**
- All previous permissive policies DROPPED
- New policy returns `false` = no client can read
- Table kept for backward compatibility / data migration
- New code uses `post_qa_questions` + `post_qa_answers`

---

### 5. content_cache

**Status:** ⚠️ RLS DISABLED

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| (none - RLS disabled) | - | - | - |

**Risk assessment:**
- Contains cached article content (public URLs)
- No user-specific data
- Used by edge functions with service_role
- **Recommendation:** Enable RLS with service_role-only access if caching sensitive content

---

### 6. youtube_transcripts_cache

**Status:** 🟢 SECURE

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Service role can insert transcripts | INSERT | - | `true` |

**Security notes:**
- No SELECT policy = no client reads
- INSERT only for service_role (edge functions)
- Contains public YouTube transcripts

---

### 7. trust_scores

**Status:** 🟢 SECURE

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Service role can insert trust scores | INSERT | - | `true` |
| Service role can update trust scores | UPDATE | `true` | - |

**Security notes:**
- No SELECT policy for anon/authenticated
- Access only via `get-trust-score` edge function
- Edge function requires valid JWT

---

### 8. message_deletions

**Status:** 🟢 LOW RISK

| Policy | Command | USING | WITH CHECK |
|--------|---------|-------|------------|
| Users can delete own message deletions | DELETE | `auth.uid() = user_id` | - |
| Users can insert own message deletions | INSERT | - | `auth.uid() = user_id` |
| Users can view own message deletions | SELECT | `auth.uid() = user_id` | - |

**Security notes:**
- Properly scoped to `auth.uid() = user_id`
- Users can only see/manage their own deletions

---

## Edge Functions Security

### get-qa
- ✅ Requires valid JWT
- ✅ Returns ONLY questions (no correctId)
- ✅ Validates ownership or public post access
- ✅ Rejects expired Q&A (410 Gone)

### submit-qa
- ✅ Requires valid JWT
- ✅ Rate limiting (10 attempts / 5 min)
- ✅ Server-side validation only
- ✅ Never returns correct answers
- ✅ Logs attempts to `post_gate_attempts`

### generate-qa
- ✅ Extracts owner_id from JWT
- ✅ Saves questions to `post_qa_questions`
- ✅ Saves answers to `post_qa_answers` (separate table)
- ✅ Returns questions with correctId stripped

---

## Recommendations

### Immediate (Already Done)
- [x] Split post_qa into questions/answers tables
- [x] Remove all client SELECT on correct_answers
- [x] Implement rate limiting for submissions
- [x] Add expiration handling

### Future Considerations
1. Enable RLS on `content_cache` with service_role-only policies
2. Add IP-based rate limiting for additional protection
3. Consider adding CAPTCHA for repeat failures
4. Monitor `post_gate_attempts` for abuse patterns

---

## Gate Hardening Checklist (Definition of Done)

### A) UX Invariata
- [x] Nessuna risposta corretta mostrata all'utente
- [x] Feedback "riprova" basato su `wrongIndexes` (server-side)
- [x] Stesso flow step/modal/copy

### B) Sicurezza
- [x] Nessun `correctId`/`correct_answers` in network responses
- [x] Validazione solo via `submit-qa` edge function
- [x] Rate limiting attivo (10 tentativi / 5 min)

### C) No Bypass
- [x] `apiSubmitAnswers` in comprehension-gate.tsx → throws Error (deprecated)
- [x] `apiCreateOrGetQuiz` in comprehension-gate.tsx → throws Error (deprecated)
- [x] `validate-answers` edge function → returns 410 Gone
- [x] Nessun "mock passed" o "assume correct" nel codebase
- [x] `ComprehensionTest.tsx` → hard-fail senza fallback mock (v2.2)

### D) Focus/Il Punto
- [x] `qaId` generato server-side via `generate-qa`
- [x] `FocusDetailSheet` passa `qaId` a `submit-qa`
- [x] `ImmersiveEditorialCarousel` passa `qaId` a `submit-qa`

---

## Changelog

- **2026-01-06 v2.2**: Complete audit and mock removal
  - Removed fallback mock questions from `ComprehensionTest.tsx`
  - Hard-fail if no server-side questions provided
  - Full grep audit completed - zero leaks confirmed

- **2026-01-06 v2.1**: Final hardening - single source of truth
  - Deprecated `apiSubmitAnswers` and `apiCreateOrGetQuiz` in comprehension-gate.tsx
  - Added `qaId` propagation from `generate-qa` to `submit-qa` in Focus/Il Punto components
  - Added Definition of Done checklist

- **2026-01-06 v2.0**: Major security hardening
  - Created `post_qa_questions` and `post_qa_answers` tables
  - Created `qa_submit_attempts` for rate limiting
  - New edge functions: `get-qa`, `submit-qa`
  - Updated `generate-qa` to use split tables
  - Blocked legacy `post_qa` table access

- **2026-01-06 v1.0**: Initial audit
  - Identified `correct_answers` exposure vulnerability
  - Documented `trust_scores` hardening
