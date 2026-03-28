import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// VAPID Public Key - safe to expose in frontend
const VAPID_PUBLIC_KEY = 'BBZe7cI-AdlX4-6YWLqaI6qbwIsi9JZ-c2zQT2Ay5DdMFFtlUIIad_JpRkecMOJRqJpwxx-UeEQ8Axst9t9I9Gk';

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

// Convert ArrayBuffer to base64url string (Safari-safe)
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Extract subscription keys using getKey() first, then toJSON() fallback
function extractSubscriptionKeys(subscription: PushSubscription): { p256dh: string; auth: string } | null {
  let p256dh = '';
  let auth = '';

  // Primary: use getKey() — more reliable on Safari/iOS
  try {
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    if (p256dhKey && authKey) {
      p256dh = arrayBufferToBase64Url(p256dhKey);
      auth = arrayBufferToBase64Url(authKey);
      console.log('[Push] Keys extracted via getKey() ✓', { p256dhLen: p256dh.length, authLen: auth.length });
    }
  } catch (e) {
    console.warn('[Push] getKey() failed, trying toJSON fallback:', e);
  }

  // Fallback: toJSON().keys
  if (!p256dh || !auth) {
    try {
      const json = subscription.toJSON();
      p256dh = json.keys?.p256dh || '';
      auth = json.keys?.auth || '';
      console.log('[Push] Keys extracted via toJSON() fallback', { p256dhLen: p256dh.length, authLen: auth.length });
    } catch (e) {
      console.error('[Push] toJSON() also failed:', e);
    }
  }

  if (!p256dh || !auth) {
    console.error('[Push] Could not extract subscription keys');
    return null;
  }

  return { p256dh, auth };
}

// Parse iOS version from user agent
function parseIOSVersion(userAgent: string): number | null {
  const match = userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

export type PushSyncError = 'unsupported' | 'permission_denied' | 'no_keys' | 'db_error' | 'unknown';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // iOS/PWA detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    document.referrer.includes('android-app://') ||
    (isIOS && !window.navigator.userAgent.includes('Safari') && window.navigator.userAgent.includes('AppleWebKit'))
  );
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

      // VAPID key mismatch detection
      if (browserSubscription) {
        try {
          const currentKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const existingKeyBytes = new Uint8Array(browserSubscription.options?.applicationServerKey || []);
          
          if (existingKeyBytes.length > 0 && currentKeyBytes.length === existingKeyBytes.length) {
            let mismatch = false;
            for (let i = 0; i < currentKeyBytes.length; i++) {
              if (currentKeyBytes[i] !== existingKeyBytes[i]) {
                mismatch = true;
                break;
              }
            }
            if (mismatch) {
              console.log('[Push] ⚠️ VAPID key mismatch detected! Forcing re-subscribe...');
              await browserSubscription.unsubscribe();
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id)
                .eq('endpoint', browserSubscription.endpoint);
              const result = await subscribeToPush();
              console.log('[Push] VAPID key re-subscribe result:', result.success);
              return;
            }
          }
        } catch (keyCheckErr) {
          console.warn('[Push] Could not compare VAPID keys:', keyCheckErr);
        }
      }

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
        const result = await subscribeToPush();
        console.log('[Push] Re-sync result:', result.success);
        return;
      }

      if (!dbSubscription) {
        const result = await subscribeToPush();
        console.log('[Push] Auto-registration result:', result.success);
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
        const syncResult = await subscribeToPush();
        if (syncResult.success) {
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

  /** Persist subscription to DB with fallback for legacy single-row conflicts */
  const persistSubscription = async (
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string
  ): Promise<{ success: boolean; error?: PushSyncError }> => {
    const payload = {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      created_at: new Date().toISOString()
    };

    // Try upsert with composite key first
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,endpoint' });

    if (!upsertError) {
      return { success: true };
    }

    console.warn('[Push] Upsert failed, trying fallback:', upsertError.message);

    // Fallback: delete all user's subscriptions and insert fresh
    // This handles the case where a legacy unique index on user_id alone
    // blocks the upsert (even though we're migrating it away)
    try {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[Push] Fallback delete failed:', deleteError);
        return { success: false, error: 'db_error' };
      }

      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert(payload);

      if (insertError) {
        console.error('[Push] Fallback insert failed:', insertError);
        return { success: false, error: 'db_error' };
      }

      return { success: true };
    } catch (e) {
      console.error('[Push] Fallback exception:', e);
      return { success: false, error: 'db_error' };
    }
  };

  const subscribeToPush = async (): Promise<{ success: boolean; error?: PushSyncError }> => {
    if (!user) return { success: false, error: 'unknown' };

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const pm = (registration as any).pushManager;
      if (!pm) {
        console.error('[Push] PushManager unavailable on service worker registration');
        return { success: false, error: 'unsupported' };
      }

      // Check if already subscribed in browser
      let subscription = await pm.getSubscription();
      console.log('[Push] Existing browser subscription:', !!subscription);

      // If not, subscribe new
      if (!subscription) {
        if (!('Notification' in window)) {
          console.error('[Push] Notification API unavailable');
          return { success: false, error: 'unsupported' };
        }

        let currentPermission: NotificationPermission = Notification.permission;
        if (currentPermission !== 'granted') {
          currentPermission = await Notification.requestPermission();
          setPermission(currentPermission);
        }

        if (currentPermission !== 'granted') {
          console.error('[Push] Notification permission not granted:', currentPermission);
          return { success: false, error: 'permission_denied' };
        }

        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        console.log('[Push] Creating new push subscription');
        subscription = await pm.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer
        });
      }

      // Extract keys using Safari-safe method
      const keys = extractSubscriptionKeys(subscription);
      if (!keys) {
        return { success: false, error: 'no_keys' };
      }

      const endpoint = subscription.endpoint;
      console.log('[Push] Saving subscription endpoint:', endpoint.slice(0, 80));

      const result = await persistSubscription(user.id, endpoint, keys.p256dh, keys.auth);

      if (result.success) {
        setIsSubscribed(true);
        console.log('[Push] Subscription synced successfully ✓');
      }

      return result;
    } catch (error) {
      console.error('[Push] Error subscribing to push:', error);
      return { success: false, error: 'unknown' };
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

  const forceSync = async (): Promise<{ success: boolean; error?: PushSyncError }> => {
    return await subscribeToPush();
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
