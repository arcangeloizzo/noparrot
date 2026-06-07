import React from 'react';
import { Instagram, Youtube, Linkedin, Twitter } from 'lucide-react';

export type ExternalPlatform = 'instagram' | 'youtube' | 'linkedin' | 'twitter';

interface CardExternalCTAProps {
  platform: ExternalPlatform;
  url: string;
}

const PLATFORM_CONFIG: Record<ExternalPlatform, {
  label: string;
  Icon: typeof Instagram;
  background: string;
}> = {
  instagram: {
    label: 'Apri su Instagram',
    Icon: Instagram,
    background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 60%, #F77737 100%)',
  },
  youtube: {
    label: 'Apri su YouTube',
    Icon: Youtube,
    background: '#FF0000',
  },
  linkedin: {
    label: 'Apri su LinkedIn',
    Icon: Linkedin,
    background: '#0A66C2',
  },
  twitter: {
    label: 'Apri su X',
    Icon: Twitter,
    background: '#000000',
  },
};

export const CardExternalCTA = React.forwardRef<HTMLDivElement, CardExternalCTAProps>(
  ({ platform, url }, ref) => {
    const { label, Icon, background } = PLATFORM_CONFIG[platform];
    
    return (
      <div 
        ref={ref}
        className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
        style={{ bottom: '170px' }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
          style={{ background }}
          aria-label={label}
        >
          <Icon className="w-3.5 h-3.5 text-white" />
          <span className="text-[12px] font-medium text-white tracking-wide whitespace-nowrap">
            {label}
          </span>
        </button>
      </div>
    );
  }
);

CardExternalCTA.displayName = 'CardExternalCTA';
