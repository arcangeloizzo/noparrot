import { useState, useEffect } from 'react';
import { Bell, X, Share, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export const NotificationPermissionBanner = () => {
  const { permission, isSupported, isSubscribed, isIOS, isPWA, requestPermission, forceSync } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Cleanup old key
    localStorage.removeItem('notification-banner-dismissed');
    // Check new versioned key
    const wasDismissed = localStorage.getItem('notification-banner-dismissed-v2');
    setDismissed(wasDismissed === 'true');
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notification-banner-dismissed-v2', 'true');
  };

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setDismissed(true);
    }
  };

  const handleCompleteActivation = async () => {
    setSyncing(true);
    try {
      await forceSync();
    } finally {
      setSyncing(false);
    }
  };

  // iOS Safari (not PWA) - show install instructions
  if (isIOS && !isPWA && !dismissed) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground",
        "border-b border-primary-foreground/20 shadow-lg"
      )}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <Share className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Installa l'app per le notifiche
            </p>
            <p className="text-xs opacity-90">
              Tocca <Share className="w-3 h-3 inline mx-0.5" /> poi "Aggiungi a Home"
            </p>
          </div>
          
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-primary-foreground/10 transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Fallback: User has granted permission but is not subscribed in DB
  // This helps existing users who gave permission before the subscription logic was added
  if (isSupported && permission === 'granted' && !isSubscribed && !dismissed) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white",
        "border-b border-amber-600 shadow-lg"
      )}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <RefreshCw className={cn("w-5 h-5 flex-shrink-0", syncing && "animate-spin")} />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Completa l'attivazione delle notifiche
            </p>
            <p className="text-xs opacity-90">
              Un ultimo passaggio per ricevere notifiche push
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCompleteActivation}
              disabled={syncing}
              className="text-xs bg-white text-amber-600 hover:bg-amber-50"
            >
              {syncing ? 'Attivando...' : 'Attiva'}
            </Button>
            
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't show banner if:
  // - Not supported (and not iOS non-PWA which we handle above)
  // - Already granted permission and subscribed
  // - User dismissed it
  // - Permission was denied
  if (!isSupported || (permission === 'granted' && isSubscribed) || dismissed || permission === 'denied') {
    return null;
  }

  // Standard banner for PWA or other browsers - ask for permission
  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground",
      "border-b border-primary-foreground/20 shadow-lg"
    )}>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <Bell className="w-5 h-5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            Attiva le notifiche
          </p>
          <p className="text-xs opacity-90">
            Ricevi notifiche in tempo reale per like, commenti e menzioni
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleEnable}
            className="text-xs"
          >
            Attiva
          </Button>
          
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-primary-foreground/10 transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
