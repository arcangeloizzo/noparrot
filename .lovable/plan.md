

## Problem

After a failed logout + force close, the app gets stuck on skeletons (the screenshot confirms this). The root cause:

1. `signOut()` didn't complete → Supabase session token stays in localStorage but is corrupted/expired
2. On reopen, `getSession()` returns a stale session → `user` is set to non-null → Feed renders
3. All data queries (`usePosts`, `useDailyFocus`) fail silently with auth errors → `isLoading` stays `true` forever → eternal skeleton screen
4. There's no error recovery: if queries throw due to bad auth, nothing forces a sign-out

## Plan

### Step 1: Add auth error recovery to Feed queries
In `src/pages/Feed.tsx`, detect when both `usePosts` and `useDailyFocus` have errored out (especially with auth-related errors like 401/PGRST). When this happens, force `signOut()` to clear the corrupted session and redirect to the auth page.

### Step 2: Add query error + timeout fallback in Feed
If `isLoading` persists for more than ~10 seconds, show a recovery UI ("Sessione scaduta" + Logout button) instead of infinite skeletons. This catches any edge case where queries hang without erroring.

### Step 3: Harden signOut in AuthContext
Make `signOut()` more robust: even if `supabase.auth.signOut()` fails (network error, etc.), manually clear localStorage keys (`sb-*`) to ensure the stale session is removed. This prevents the app from getting stuck on reopen after a failed logout.

## Technical details

**Files to modify:**
- `src/pages/Feed.tsx` — add `isError` from usePosts/useDailyFocus, auto-signout on auth error, timeout fallback UI
- `src/contexts/AuthContext.tsx` — harden `signOut` to clear storage even if API call fails

