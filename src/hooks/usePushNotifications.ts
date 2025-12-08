import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

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
    // Check if Push API is supported
    const hasNotification = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const supported = hasNotification && hasServiceWorker && hasPushManager;
    
    console.log('[usePushNotifications] Browser support check:', {
      hasNotification,
      hasServiceWorker,
      hasPushManager,
      supported,
      isIOS,
      isPWA,
      iOSVersion
    });
    
    setIsSupported(supported);
    
    if (hasNotification) {
      console.log('[usePushNotifications] Current permission:', Notification.permission);
      setPermission(Notification.permission);
    }

    // Check if already subscribed
    if (supported && user) {
      checkExistingSubscription();
    }
  }, [user]);

  const checkExistingSubscription = async () => {
    if (!user) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Verifica se la sottoscrizione è salvata nel database
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();
        
        if (error) {
          console.error('[Push] Error checking DB subscription:', error);
          setIsSubscribed(false);
          return;
        }
        
        if (data) {
          console.log('[Push] Subscription found in DB');
          setIsSubscribed(true);
        } else {
          // La sottoscrizione esiste nel browser ma non nel DB - ri-registrala
          console.log('[Push] Browser subscription exists but not in DB - auto-registering...');
          const success = await subscribeToPush();
          console.log('[Push] Auto-registration result:', success);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast({
        title: 'Non supportato',
        description: 'Le notifiche push non sono supportate su questo dispositivo',
        variant: 'destructive'
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Subscribe to push notifications
        const subscribed = await subscribeToPush();
        
        if (subscribed) {
          toast({
            title: 'Notifiche attivate!',
            description: 'Riceverai notifiche per nuovi like, commenti, menzioni e messaggi'
          });
          return true;
        }
      } else if (result === 'denied') {
        toast({
          title: 'Permesso negato',
          description: 'Per ricevere notifiche, abilita i permessi nelle impostazioni del browser',
          variant: 'destructive'
        });
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile richiedere il permesso per le notifiche',
        variant: 'destructive'
      });
      return false;
    }
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!user) {
      console.error('No user logged in');
      return false;
    }

    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      
      console.log('[Push] Service Worker registered:', registration);

      // ALWAYS remove old subscription first to force a fresh one
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[Push] Unsubscribing from old subscription:', existingSubscription.endpoint);
        await existingSubscription.unsubscribe();
        
        // Also delete from database if present
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
        
        console.log('[Push] Old subscription removed');
      }

      // Create ALWAYS a new subscription
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });
      console.log('[Push] Created NEW push subscription:', subscription.endpoint);

      // Extract subscription details
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      if (!p256dh || !auth) {
        console.error('[Push] Missing subscription keys');
        return false;
      }

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
        });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        return false;
      }

      setIsSubscribed(true);
      console.log('[Push] Push subscription saved successfully');
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
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifiche disattivate',
        description: 'Non riceverai più notifiche push'
      });
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

  // Force sync - esposto per debug
  const forceSync = async (): Promise<boolean> => {
    console.log('[Push] Force sync started...');
    const result = await subscribeToPush();
    console.log('[Push] Force sync result:', result);
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
    forceSync // Esposto per debug
  };
};
