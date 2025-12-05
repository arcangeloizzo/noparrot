// Service Worker for Push Notifications - NoParrot

// Cache name for offline support
const CACHE_NAME = 'noparrot-v1';

// Install event
self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('[SW] Service worker activated');
  event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', function(event) {
  console.log('[SW] Push notification received');
  
  event.waitUntil(
    (async () => {
      // Check if any window is focused - if so, the app will show local notification
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      const hasVisibleClient = windowClients.some(client => 
        client.visibilityState === 'visible' && client.focused
      );
      
      // If app is open and focused, skip showing push notification to avoid duplicates
      if (hasVisibleClient) {
        console.log('[SW] App is in foreground, skipping push notification');
        return;
      }
      
      let data = {};
      
      try {
        if (event.data) {
          data = event.data.json();
        }
      } catch (e) {
        console.error('[SW] Error parsing push data:', e);
        data = {
          title: 'NoParrot',
          body: event.data?.text() || 'Nuova notifica'
        };
      }
      
      const title = data.title || 'NoParrot';
      const options = {
        body: data.body || 'Hai una nuova notifica',
        icon: data.icon || '/lovable-uploads/feed-logo.png',
        badge: data.badge || '/lovable-uploads/feed-logo.png',
        tag: data.tag || 'noparrot-notification',
        data: data.data || {},
        vibrate: [100, 50, 100],
        requireInteraction: false,
        actions: data.type === 'message' ? [
          { action: 'reply', title: 'Rispondi' },
          { action: 'view', title: 'Visualizza' }
        ] : [
          { action: 'view', title: 'Visualizza' }
        ]
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  const notificationType = event.notification.data?.type;
  
  // Handle action buttons
  if (event.action === 'reply' && notificationType === 'message') {
    // For reply action, open the message thread
    event.waitUntil(openUrl(urlToOpen));
  } else {
    // Default action - open the URL
    event.waitUntil(openUrl(urlToOpen));
  }
});

// Helper function to open URL
async function openUrl(url) {
  const fullUrl = new URL(url, self.location.origin).href;
  
  // Check if a window is already open
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });
  
  // Try to find an existing window and navigate it
  for (const client of windowClients) {
    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
      await client.focus();
      if ('navigate' in client) {
        await client.navigate(fullUrl);
      }
      return;
    }
  }
  
  // No existing window, open a new one
  if (clients.openWindow) {
    return clients.openWindow(fullUrl);
  }
}

// Notification close handler
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed');
});

// Handle messages from the main app
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});