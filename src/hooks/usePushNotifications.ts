import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if Push API is supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

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
        toast({
          title: 'Notifiche attivate!',
          description: 'Riceverai notifiche per nuovi like, commenti e menzioni'
        });
        
        // Subscribe to push notifications
        await subscribeToPush();
        return true;
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

  const subscribeToPush = async () => {
    if (!user) return;

    try {
      // Register service worker for push notifications
      const registration = await navigator.serviceWorker.ready;
      
      // For now, we'll use web notifications without a push server
      // To enable push notifications, you'll need to:
      // 1. Generate VAPID keys
      // 2. Set up a push server
      // 3. Store subscription in database
      
      console.log('Service Worker ready for notifications');

    } catch (error) {
      console.error('Error subscribing to push:', error);
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

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification
  };
};
