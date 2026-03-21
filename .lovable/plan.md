

## Problem Analysis

The freeze when clicking Home is caused by the **onboarding tutorial activating for existing users**.

When the `has_dismissed_tutorial` column was added with `DEFAULT false`, **all existing users** got `false` — meaning the tutorial starts for them on every app load. The tutorial:

1. Locks body scroll (`document.body.style.overflow = "hidden"`)
2. Renders a full-screen dark overlay at `z-[99999]`, blocking all interaction
3. Runs a continuous `requestAnimationFrame` loop polling DOM elements 60 times/second

Users who registered months ago (Maurizio from Oct 2025, Marco Izzo from Oct 2025, etc.) all have `has_dismissed_tutorial = false`. When they open the app or navigate to Home, the tutorial overlay appears as a dark screen that blocks everything — perceived as a freeze.

Additionally, the continuous RAF loop (lines 159-205 in `useOnboardingTutorial.ts`) never stops polling while the tutorial is active, which causes unnecessary CPU usage on mobile.

## Plan

### Step 1: Database fix — dismiss tutorial for all existing users
Run a migration to set `has_dismissed_tutorial = true` for all profiles created before the tutorial feature was deployed (before ~March 16, 2026). Only truly new users going forward should see the tutorial.

```sql
UPDATE profiles 
SET has_dismissed_tutorial = true 
WHERE created_at < '2026-03-16T00:00:00Z' 
  AND has_dismissed_tutorial = false;
```

### Step 2: Replace RAF loop with IntersectionObserver/ResizeObserver
The current `requestAnimationFrame` loop in `useOnboardingTutorial.ts` (lines 159-205) runs `document.querySelector` + `getBoundingClientRect` on every frame indefinitely. Replace with:
- A `ResizeObserver` + single initial measurement
- Re-measure only on `resize`/`scroll` events (already partially implemented)
- Remove the recursive `requestAnimationFrame(updateRect)` call

### Step 3: Add safety guard for tutorial activation
In `useOnboardingTutorial.ts`, add a check so the tutorial only activates if the user registered recently (e.g., within the last 7 days) OR if a specific flag like `is_new_user` is set. This prevents edge cases where the DB update doesn't reach a user in time.

### Technical details

**Files to modify:**
- `src/hooks/useOnboardingTutorial.ts` — replace RAF loop with event-driven measurement; add registration date guard
- Database migration — bulk update existing users

**Risk:** None for existing users (they skip the tutorial). New users still get the full onboarding experience.

