

# Challenge Features + Visual Redesign — Implementation Plan

## Step 1: Database Migration

**`challenge_votes` table — add `challenge_id` column:**
```sql
ALTER TABLE challenge_votes ADD COLUMN challenge_id uuid REFERENCES challenges(id);
UPDATE challenge_votes cv SET challenge_id = cr.challenge_id 
  FROM challenge_responses cr WHERE cr.id = cv.challenge_response_id;
ALTER TABLE challenge_votes ALTER COLUMN challenge_id SET NOT NULL;
ALTER TABLE challenge_votes ADD CONSTRAINT one_vote_per_user_per_challenge UNIQUE (user_id, challenge_id);
```

**`voice_posts` INSERT RLS — allow standalone inserts (challenge responses have `post_id = NULL`):**
Current policy only allows insert if `auth.uid()` matches `posts.author_id` via `post_id` FK. Challenge response voice posts have `post_id = NULL`, so the edge function will use `service_role` — no RLS change needed.

**`challenge_votes` RLS — add DELETE policy? No.** Votes are irrevocable per spec. Current policies (INSERT for authenticated, SELECT for authenticated) are correct. The unique constraint on `(user_id, challenge_id)` enforces one vote per challenge.

---

## Step 2: Edge Function `submit-challenge-response`

Create `supabase/functions/submit-challenge-response/index.ts`:

- CORS headers + OPTIONS handler
- Validate JWT via `getClaims(token)` → get `userId`
- Parse body: `{ challenge_id, audio_base64, stance, duration_seconds, waveform_data }`
- Use `service_role` client for DB operations:
  1. Fetch challenge to get `post_id`, verify `status = 'active'`
  2. Verify gate passed: check `post_gate_attempts` for `user_id + post_id + passed = true`
  3. Check no existing response: `challenge_responses` where `challenge_id + user_id`
  4. Upload audio to `voice-audio` bucket: `{userId}/{challenge_id}_response.webm`
  5. Create `voice_posts` record (null `post_id`, `transcript_status: 'pending'`)
  6. Create `challenge_responses` record (`gate_passed: true`)
  7. Update `challenges.votes_for` or `votes_against` (+1)
  8. Invoke `transcribe-audio` with the new `voicePostId`
  9. Send push notification to challenge author via `send-push-notification`
  10. Return `{ response_id }`

Add to `supabase/config.toml`:
```toml
[functions.submit-challenge-response]
verify_jwt = false
```

---

## Step 3: Hook `useChallengeResponses`

Create `src/hooks/useChallengeResponses.ts`:
- `useChallengeResponses(challengeId: string | null)` — TanStack Query, `enabled: !!challengeId`
- Fetches `challenge_responses` joined with `voice_posts` and `profiles` (via two queries since no FK to profiles in Supabase types)
- Also fetches current user's vote from `challenge_votes` where `challenge_id`
- Returns `{ responses, userVote, isLoading }`
- Exposes `voteForResponse` mutation (inserts into `challenge_votes` with `challenge_response_id` and `challenge_id`)

---

## Step 4: Component `AcceptChallengeFlow`

Create `src/components/feed/AcceptChallengeFlow.tsx`:
- Uses `Sheet` (bottom sheet) with 4 internal steps:
  - **Step 1 — Gate**: Reuse existing quiz flow (the `handleChallengeRespond` in FeedCardAdapt already generates the quiz and shows it). After quiz passed, open this flow at step 2.
  - **Step 2 — Stance choice**: Two large buttons — "Contro la tesi" (`#FFD464`) and "A favore" (`#0A7AFF`)
  - **Step 3 — Recording**: Embed `VoiceRecorder` (max 3 min)
  - **Step 4 — Preview + Submit**: Show `VoicePlayer` with recorded audio, confirm button calls `submit-challenge-response` edge function

Wire into `FeedCardAdapt.tsx`: after quiz passes (existing `onChallengeRespond` flag), open `AcceptChallengeFlow` at step 2 instead of the current `onQuoteShare`.

---

## Step 5: Visual Redesign — Yellow/Blue Palette

### ChallengeCard.tsx
- Card gradient: `rgba(255,212,100,0.06)` → `rgba(10,122,255,0.06)` (was red→green)
- Thesis block gradient: yellow→blue
- Polarization bar: "Contro" = `#FFD464`, "A favore" = `#0A7AFF`
- Vote buttons: yellow/blue styling
- Stance badges in challengers: yellow/blue
- Mini-player `accentColor`: `#FFD464` (against) / `#0A7AFF` (for)
- Challenge badge stays `#E41E52`
- CTA gradient: `rgba(255,212,100,0.08)` → `rgba(10,122,255,0.12)`
- Countdown timer: `useEffect` + `setInterval(60s)`, orange `#FF8A3D` for <2h
- Wire `useChallengeResponses` for on-demand challenger loading
- Expired state: "Chiusa" badge, disabled CTA

### ImmersivePostCard.tsx (lines 1547-1584)
- Same palette change for condensed challenge view

### VoicePlayer.tsx
- Remove `📝` emoji from transcript button (line 270), use just `FileText` icon + "Testo"
- Controls: `borderRadius: 10`, add `backdropFilter: 'blur(4px)'`, `letterSpacing: '0.3px'`, `fontWeight: 600`

### Badge alignment (FeedCardAdapt + ImmersivePostCard)
- Voice badge: `h-[24px] px-2.5 text-[11px] rounded-lg font-bold tracking-[0.5px]`, colors `rgba(255,212,100,0.15)` / `#FFD464`
- Challenge badge: same dimensions, colors `rgba(228,30,82,0.15)` / `#E41E52`

---

## Step 6: Background Waveform PNGs

Generate two minimal SVG-based inline data URIs (white paths on transparent) for:
- `public/assets/voice-wave-bg.png` — single irregular waveform
- `public/assets/challenge-wave-bg.png` — dual overlapping waveforms

Applied as `position: absolute` background in immersive card wrappers, `opacity: 0.04` / `0.025`, `pointer-events: none`.

---

## Files to Create
1. `supabase/functions/submit-challenge-response/index.ts`
2. `src/components/feed/AcceptChallengeFlow.tsx`
3. `src/hooks/useChallengeResponses.ts`
4. `public/assets/voice-wave-bg.png`
5. `public/assets/challenge-wave-bg.png`

## Files to Modify
1. `supabase/config.toml` — add function config
2. `src/components/feed/ChallengeCard.tsx` — palette + countdown + wire hooks
3. `src/components/media/VoicePlayer.tsx` — remove emoji, refine controls
4. `src/components/feed/FeedCardAdapt.tsx` — badge alignment, wire AcceptChallengeFlow
5. `src/components/feed/ImmersivePostCard.tsx` — palette change

## Database Migration
- Add `challenge_id` to `challenge_votes` + NOT NULL + unique constraint

