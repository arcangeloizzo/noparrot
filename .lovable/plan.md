

# Voice Post Card & Challenge Card — Pixel-Perfect Redesign

## Overview
Full rewrite of VoicePlayer, ChallengeCard, and voice/challenge sections in FeedCardAdapt and ImmersivePostCard. All CSS values follow the exact spec provided.

---

## 1. `src/index.css` — Add shimmer keyframe
Append at the end of the file:
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}
```

## 2. `src/components/media/VoicePlayer.tsx` — Full rewrite

**New prop:** `accentColor?: string` (default `#0A7AFF`)

**Waveform generation:** Bell-curve + random variation (`Math.exp` gaussian centered, multiplied by `0.3 + Math.random() * 0.7`), `min-height: 3px` per bar. Memoized with `useMemo`.

**Full player container:**
- Inline styles for exact spec: `linear-gradient(135deg, ${accentColor}0F, rgba(255,255,255,0.03), ${accentColor}0A)`, `border: 1px solid rgba(255,255,255,0.10)`, `border-radius: 18px`, `padding: 16px 18px`, `backdrop-filter: blur(8px)`

**Play button (46x46px):**
- `radial-gradient(circle at 40% 35%, accentColor, accentColor/0.8)`
- `box-shadow: 0 0 20px accentColor/0.25, 0 0 40px accentColor/0.12`
- When playing: spinning ring border (`1.5px solid accentColor/0.2`, `animate-spin` with 3s duration) positioned absolute around the button

**Waveform:** 50 bars (30 compact), width `2.5px`, gap `1.5px`, border-radius `2px`, height 36px container. Played bars = `accentColor`, unplayed = `rgba(255,255,255,0.12)`.

**Time:** `{current} / {total}` under waveform left, 11px.

**Controls row (right-aligned):** Speed toggle + Transcript button, both with `padding: 3px 8px`, `border-radius: 6px`, `bg: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.08)`. Transcript active: `bg: accentColor/0.12`, `border: accentColor/0.25`, `color: accentColor`.

**Transcript block:** `bg: rgba(0,0,0,0.2)`, `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 12px`, `padding: 12px 14px`, `max-height: 100px`, `overflow-y: auto`, text 12.5px, `color: rgba(241,245,249,0.6)`.

**Compact variant:** h-7 w-7 play button, 22px waveform height, 30 bars, no controls row, no transcript. Accent color via `accentColor` prop.

## 3. `src/components/feed/ChallengeCard.tsx` — Full redesign

**Card wrapper:**
- `background: linear-gradient(160deg, rgba(228,30,82,0.08) 0%, transparent 40%, rgba(52,211,153,0.04) 100%)`
- Keep existing `rounded-2xl border border-brand-pink/20`

**Header/Author section:** Keep existing badge + author layout (already good).

**Thesis block (replaces current plain `<h3>`):**
- Wrap in container: `linear-gradient(145deg, rgba(228,30,82,0.06), rgba(255,255,255,0.02), rgba(52,211,153,0.04))`, `border: 1px solid rgba(228,30,82,0.15)`, `border-radius: 18px`, `padding: 18px 20px`, `position: relative`
- Decorative `"` quote: absolute, top 10px, left 14px, font-size 48px, `color: rgba(228,30,82,0.1)`, font-family Georgia/serif
- Thesis text: 16px bold, line-height 1.5, white
- VoicePlayer **INSIDE** this block (below thesis, `mt-3`), with `accentColor="#E41E52"`
- Player container override: Pass a challenge-specific container style or let VoicePlayer use the accentColor gradient naturally

**Polarization bar (existing, refined):**
- Bar height `6px`, border-radius `3px`
- Contra gradient: `linear-gradient(90deg, #E41E52, rgba(228,30,82,0.8))`, `box-shadow: 0 0 8px rgba(228,30,82,0.2)`
- Pro gradient: `linear-gradient(90deg, rgba(52,211,153,0.8), #34D399)`, `box-shadow: 0 0 8px rgba(52,211,153,0.2)`
- Labels: "contro" left, "a favore" right, 11px `rgba(241,245,249,0.3)`
- Percentages: font-weight 800, 14px

**Challenger section (existing, refined):**
- Container: `bg: rgba(0,0,0,0.15)`, `border: 1px solid rgba(255,255,255,0.07)`, `border-radius: 16px`, margin 0 16px
- Header: 12px font-weight 600 `rgba(241,245,249,0.6)`
- Rank #1: `bg: rgba(255,212,100,0.13)`, `color: #FFD464`, `border: 1px solid rgba(255,212,100,0.2)`, w-[22px] h-[22px] rounded-[7px]
- Rank #2+: `bg: rgba(255,255,255,0.05)`, muted color
- Stance badges: exact spec colors with border
- Gate badge: `bg: rgba(52,211,153,0.1)`, `color: #34D399`, text "✓ Gate"
- Compact VoicePlayer with `accentColor` matching stance (`#34D399` for, `#E41E52` against), margin-left 32px
- Vote button: "🧠 Miglior argomento", voted state = blue bg/border, others opacity 0.4

**CTA "Accetta la sfida":**
- `background: linear-gradient(135deg, rgba(228,30,82,0.12), rgba(52,211,153,0.08))`
- `border: 1px solid rgba(228,30,82,0.2)`, `border-radius: 16px`, `padding: 14px 20px`
- Text: "⚡ Accetta la sfida" 14px bold + "· metti a fuoco prima" 12px muted
- Shimmer overlay: `position: absolute`, `overflow: hidden`, white gradient sweeping left-to-right, `animation: shimmer 3s infinite`

## 4. `src/components/feed/FeedCardAdapt.tsx` — Voice post section (lines ~908-926)

**Only when `isVoicePost`:**
- Wrap the voice post body in a container with `background: linear-gradient(180deg, rgba(10,122,255,0.05) 0%, transparent 120px)`
- Fix spacing: content gap 8px header→text, 12px text→player, remove `mb-3` excess
- Share button: shrink to inline `padding: 8px 16px`, `border-radius: 20px`, `bg: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)`, font-size 13px
- Ensure standard posts (`post_type !== 'voice'`) are NOT affected

## 5. `src/components/feed/ImmersivePostCard.tsx` — Lines ~1524-1541

**Voice posts (`isVoicePost`):**
- Apply same blue gradient wrapper
- Compact spacing (12px gaps max)

**Challenge posts (`isChallengePost`) in immersive:**
- Show condensed view: thesis text (bold) + VoicePlayer (accentColor `#E41E52`) + polarization bar
- Add CTA button "Apri Challenge" that opens the full ChallengeCard in a bottom sheet (using existing Sheet/Drawer component)

---

## Spacing rules (applied everywhere)
- No text → player starts 12px below header
- With text → 8px header→text, 12px text→player
- Player → action bar: 12-14px
- Zero empty space

## Files touched
1. `src/index.css` — shimmer keyframe
2. `src/components/media/VoicePlayer.tsx` — full rewrite
3. `src/components/feed/ChallengeCard.tsx` — full redesign
4. `src/components/feed/FeedCardAdapt.tsx` — voice post wrapper + spacing
5. `src/components/feed/ImmersivePostCard.tsx` — voice/challenge wrappers

