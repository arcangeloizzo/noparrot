import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type BadgeKind =
  | 'ai-voice'      // ✦ VOCE AI — #A78BFA
  | 'ai-synthesis'  // ✦ AI SYNTHESIS — var(--blue)
  | 'challenge'     // ⚡ CHALLENGE — var(--pink)
  | 'voicecast'     // 🎙 VOICECAST — var(--blue)
  | 'repost'        // ↻ REPOST — #34D399
  | 'neutral';      // stato/neutro — bianco trasparente

const COLOR_MAP: Record<BadgeKind, string> = {
  'ai-voice':     '#A78BFA',
  'ai-synthesis': 'var(--blue)',
  'challenge':    'var(--pink)',
  'voicecast':    'var(--blue)',
  'repost':       '#34D399',
  'neutral':      'rgba(255,255,255,0.7)',
};

interface UnifiedBadgeProps {
  kind: BadgeKind;
  children: ReactNode;
  className?: string;
}

export function UnifiedBadge({ kind, children, className }: UnifiedBadgeProps) {
  const color = COLOR_MAP[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'h-[26px] rounded-[13px] px-[11px]',
        'text-[10.5px] font-semibold uppercase tracking-[0.08em]',
        'whitespace-nowrap',
        className
      )}
      style={{
        color,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: kind === 'neutral'
          ? 'rgba(255,255,255,0.35)'
          : `color-mix(in srgb, ${color} 35%, transparent)`,
        backgroundColor: kind === 'neutral'
          ? 'rgba(255,255,255,0.08)'
          : `color-mix(in srgb, ${color} 8%, transparent)`,
        fontFamily: 'var(--mono)',
      }}
    >
      {children}
    </span>
  );
}