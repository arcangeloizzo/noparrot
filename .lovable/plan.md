# Session Guard Implementation - APPROVED

## Status: APPROVED - Ready for Implementation

## Key Safeguards (per user request)
1. **Fail-Safe Timeout**: Max 8 seconds for `isSessionReady` - if session check takes longer, UI unblocks anyway
2. **Singleton Pattern**: Prevents redundant session refresh calls when multiple actions fire simultaneously

---

## Implementation Details

### File 1: NEW `src/lib/sessionGuard.ts`

Create a new Session Guard module that:
- Provides `withSessionGuard()` wrapper for Edge Function calls
- Provides `markSessionNeedsVerification()` called on app resume
- Provides `getIsSessionReady()` to check current state
- Uses singleton pattern (5s cooldown between refresh attempts)
- Has 8s fail-safe timeout that unblocks UI regardless of check status
- Provides automatic retry on 401/403 auth errors

### File 2: MODIFY `src/hooks/useAppLifecycle.ts`

Changes:
- Import `markSessionNeedsVerification`, `getIsSessionReady`, `onSessionReadyChange` from sessionGuard
- Add `isSessionReady` state that syncs with sessionGuard
- Call `markSessionNeedsVerification()` instead of doing the refresh inline
- Export `isSessionReady` in the return value

### File 3: MODIFY `src/lib/ai-helpers.ts`

Wrap these functions with `withSessionGuard()`:
- `generateQA()` - line 71
- `validateAnswers()` - line 102
- `fetchArticlePreview()` - line 179

### File 4: MODIFY `src/lib/runGateBeforeAction.ts`

Wrap Edge Function invocations with `withSessionGuard()`:
- `supabase.functions.invoke('generate-qa', ...)` - lines 46 and 126
- `supabase.functions.invoke('fetch-article-preview', ...)` - line 95

### File 5: MODIFY `src/pages/Index.tsx`

Fix false positive "Sessione precedente interrotta" toasts:
- Add check for `app_visible` and `session_check_complete` events
- Only show toast if there's a REAL problem (stale lock, pending publish, or error event)
- Change lines 49-56

---

## Flow Diagram

```text
App resumes from background (>30s)
           │
           ▼
┌─────────────────────────────┐
│ markSessionNeedsVerification│
│ isSessionReady = false      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ checkAndRefreshSession()    │
│ with 8s fail-safe timeout   │
│ (singleton - max 1 per 5s)  │
└──────────────┬──────────────┘
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
 Success            Timeout/Error
     │                   │
     ▼                   ▼
isSessionReady     isSessionReady = true
    = true         (fail-open)
     │                   │
     └─────────┬─────────┘
               │
               ▼
        UI unblocked

─────────────────────────────────

User triggers action (comment, post, etc.)
               │
               ▼
┌─────────────────────────────┐
│ withSessionGuard(fn)        │
└──────────────┬──────────────┘
               │
               ▼
     isSessionReady?
       │          │
      Yes        No → wait (max 8s)
       │          │
       └────┬─────┘
            │
            ▼
┌─────────────────────────────┐
│ ensureSessionFresh()        │
│ (proactive refresh if <2min)│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Execute fn()                │
└──────────────┬──────────────┘
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
 Success            401/403 Error
     │                   │
     ▼                   ▼
  Return           Refresh + Retry
                   (max 1 retry)
```

---

## Anti-Regression Guarantees

1. **No change to normal flow**: If user doesn't go to background, everything works as before
2. **8s fail-safe timeout**: UI never freezes for more than 8 seconds
3. **Singleton refresh**: No duplicate refresh calls when multiple actions fire
4. **Fail-open design**: On error, UI unblocks anyway (with warning logged)
5. **Backward compatible**: `withSessionGuard` is additive, not breaking
6. **Breadcrumbs**: Every step is logged for diagnostics
