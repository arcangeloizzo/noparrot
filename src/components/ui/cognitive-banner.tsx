import { useEffect, useState } from 'react';
import { X, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CognitiveBannerProps {
  type: 'success' | 'info' | 'warning';
  message: string;
  duration?: number;
  onDismiss?: () => void;
  autoClose?: boolean;
}

export const CognitiveBanner = ({ 
  type, 
  message, 
  duration = 1500, 
  onDismiss,
  autoClose = true 
}: CognitiveBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!autoClose) return;

    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss, autoClose]);

  if (!isVisible) return null;

  const icons = {
    success: CheckCircle2,
    info: Info,
    warning: AlertCircle
  };

  const Icon = icons[type];

  return (
    <div
      className={cn(
        "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999]",
        "w-[90vw] max-w-[640px] min-h-[56px] max-h-[64px]",
        "flex items-center gap-4 px-6 py-4",
        "rounded-2xl shadow-lg backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        isFadingOut ? "opacity-0 scale-95" : "opacity-95 scale-100 animate-cognitive-fade-in",
        {
          'bg-[hsl(var(--cognitive-correct))] text-white': type === 'success',
          'bg-[hsl(var(--cognitive-glow-blue))] text-white': type === 'info',
          'bg-[hsl(var(--cognitive-incorrect))] text-black': type === 'warning',
        }
      )}
    >
      <Icon className="w-6 h-6 flex-shrink-0" />
      <p className="flex-1 text-[15px] font-medium leading-snug">
        {message}
      </p>
      {!autoClose && onDismiss && (
        <button
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(() => {
              setIsVisible(false);
              onDismiss();
            }, 300);
          }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// Hook per usare il banner in modo semplice
export const useCognitiveBanner = () => {
  const [banner, setBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
    duration?: number;
  } | null>(null);

  const showBanner = (
    type: 'success' | 'info' | 'warning',
    message: string,
    duration?: number
  ) => {
    setBanner({ type, message, duration });
  };

  const Banner = banner ? (
    <CognitiveBanner
      type={banner.type}
      message={banner.message}
      duration={banner.duration}
      onDismiss={() => setBanner(null)}
    />
  ) : null;

  return { showBanner, Banner };
};
