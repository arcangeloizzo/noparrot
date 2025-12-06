import { useState, useEffect } from 'react';
import { Bell, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export const NotificationPermissionBanner = () => {
  const { permission, isSupported, isSubscribed, isIOS, isPWA, iOSVersion, requestPermission, forceSync } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [showDebug, setShowDebug] = useState(true); // Temporary debug
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

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const result = await forceSync();
      alert(result ? '✅ Sync OK!' : '❌ Sync failed');
    } catch (e) {
      alert('❌ Error: ' + (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // Debug badge - temporary, shows always
  const DebugBadge = () => (
    <div 
      className="fixed bottom-20 left-2 z-[100] bg-black/90 text-white text-[10px] p-2 rounded-lg font-mono max-w-[200px]"
    >
      {showDebug ? (
        <>
          <div className="font-bold mb-1" onClick={() => setShowDebug(false)}>🔧 Debug Notifiche</div>
          <div>iOS: {isIOS ? '✅' : '❌'}</div>
          <div>PWA: {isPWA ? '✅' : '❌'}</div>
          <div>iOS ver: {iOSVersion ?? 'N/A'}</div>
          <div>Support: {isSupported ? '✅' : '❌'}</div>
          <div>Perm: {permission}</div>
          <div>Subscribed: {isSubscribed ? '✅' : '❌'}</div>
          <div>Dismissed: {dismissed ? '✅' : '❌'}</div>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-[10px] py-1 px-2 rounded"
          >
            {syncing ? '⏳ Syncing...' : '🔄 Force Sync'}
          </button>
          <div className="mt-1 text-[8px] opacity-70">tap title to minimize</div>
        </>
      ) : (
        <span onClick={() => setShowDebug(true)}>🔧</span>
      )}
    </div>
  );

  // iOS Safari (not PWA) - show install instructions
  if (isIOS && !isPWA && !dismissed) {
    return (
      <>
        <DebugBadge />
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
      </>
    );
  }

  // Don't show banner if:
  // - Not supported (and not iOS non-PWA which we handle above)
  // - Already granted permission
  // - User dismissed it
  // - Permission was denied
  if (!isSupported || permission === 'granted' || dismissed || permission === 'denied') {
    return <DebugBadge />;
  }

  // Standard banner for PWA or other browsers
  return (
    <>
      <DebugBadge />
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
    </>
  );
};
