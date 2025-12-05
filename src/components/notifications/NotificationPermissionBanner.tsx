import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export const NotificationPermissionBanner = () => {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

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

  // Don't show banner if:
  // - Not supported
  // - Already granted permission
  // - User dismissed it
  // - Permission was denied
  if (!isSupported || permission === 'granted' || dismissed || permission === 'denied') {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground",
      "border-b border-primary-foreground/20 shadow-lg",
      "mb-14" // Add margin to push content down
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
