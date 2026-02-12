import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// VAPID Public Key - safe to expose in frontend
const VAPID_PUBLIC_KEY = 'BHf7SidEhOQGopDhgv8lWvuuKrpcPP9xZMVqeRfEOtwUWnkjO9e2ieTOwmaHgk96x8OsFeiHb8BWa7NbO72BXe4';

// Convert VAPID key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Parse iOS version from user agent
function parseIOSVersion(userAgent: string): number | null {
  const match = userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // iOS/PWA detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || 
     (window.navigator as any).standalone === true);
  const iOSVersion = isIOS ? parseIOSVersion(navigator.userAgent) : null;

  useEffect(() => {
    const hasNotification = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const supported = hasNotification && hasServiceWorker && hasPushManager;
    
    console.log('[usePushNotifications] Browser support check:', {
      hasNotification, hasServiceWorker, hasPushManager, supported, isIOS, isPWA, iOSVersion
    });
    
    setIsSupported(supported);
    
    if (hasNotification) {
      setPermission(Notification.permission);
    }

    if (supported && user) {
      checkExistingSubscription();
    }
  }, [user]);

  const checkExistingSubscription = async () => {
    if (!user) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const browserSubscription = await (registration as any).pushManager.getSubscription();
      
      const { data: dbSubscription, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('[Push] Error checking DB subscription:', error);
        setIsSubscribed(false);
        return;
      }
      
      if (!browserSubscription) {
        setIsSubscribed(false);
        return;
      }
      
      if (dbSubscription && browserSubscription.endpoint !== dbSubscription.endpoint) {
        console.log('[Push] ⚠️ Domain change detected! Forcing re-sync...');
        const success = await subscribeToPush();
        console.log('[Push] Re-sync result:', success);
        return;
      }
      
      if (!dbSubscription) {
        const success = await subscribeToPush();
        console.log('[Push] Auto-registration result:', success);
        return;
      }
      
      console.log('[Push] Subscription found and matches DB ✓');
      setIsSubscribed(true);
      
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Le notifiche push non sono supportate su questo dispositivo');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const subscribed = await subscribeToPush();
        if (subscribed) {
          toast.success('Notifiche attivate! Riceverai notifiche per nuovi like, commenti, menzioni e messaggi');
          return true;
        }
      } else if (result === 'denied') {
        toast.error('Per ricevere notifiche, abilita i permessi nelle impostazioni del browser');
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Impossibile richiedere il permesso per le notifiche');
      return false;
    }
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      
      const pm = (registration as any).pushManager;

      const existingSubscription = await pm.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (deleteError) {
        console.warn('[Push] Error deleting old subscriptions:', deleteError);
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      if (!p256dh || !auth) {
        console.error('[Push] Missing subscription keys');
        return false;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('[Push] Error subscribing to push:', error);
      return false;
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast.success('Notifiche disattivate');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;
    try {
      new Notification(title, {
        icon: '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const forceSync = async (): Promise<boolean> => {
    const result = await subscribeToPush();
    return result;
  };

  return {
    permission,
    isSupported,
    isSubscribed,
    isIOS,
    isPWA,
    iOSVersion,
    requestPermission,
    unsubscribeFromPush,
    sendNotification,
    forceSync
  };
};
