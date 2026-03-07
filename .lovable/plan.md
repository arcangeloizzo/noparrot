

# Plan: Replace SVG waveforms with PNG backgrounds

## Changes

### 1. Copy uploaded images to `public/assets/`
- `IMG_6528.jpeg` -> `public/assets/voice-wave-bg.png` (blue voice waveform)
- `IMG_6529.jpeg` -> `public/assets/challenge-wave-bg.png` (blue+yellow challenge waveform)

### 2. Replace SVG blocks in `ImmersivePostCard.tsx` (lines 1537-1614)
Remove both `<svg>` blocks (voice: lines 1538-1574, challenge: lines 1575-1614) and replace with a single `<div>`:

```tsx
{(isVoicePost || isChallengePost) && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `url('/assets/${isChallengePost ? 'challenge' : 'voice'}-wave-bg.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      opacity: 0.25,
      pointerEvents: 'none',
      zIndex: 0,
    }}
  />
)}
```

### 3. Content z-index
Line 1615 already has `relative z-[1]` on the content wrapper -- no changes needed there.

