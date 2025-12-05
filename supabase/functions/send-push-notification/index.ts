import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = 'BGAkXaYkzxnwUzhyyr9OzfO_arJiEAV-i1Ev5UjTpQ2M40JoYYPqa72Bfh6vF6Ph1UfBrn5-n2f44thf_sqc_k8';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

// Helper to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to convert Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...uint8Array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Import crypto for ECDH and signing
async function generateVapidHeaders(endpoint: string): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  
  // Create JWT header and payload
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  };
  
  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import private key for signing
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  
  // Create the full key (private + public for P-256)
  const publicKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
  
  // For ES256 (P-256), we need to import as JWK
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64Url(privateKeyBytes),
  };
  
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsignedToken)
  );
  
  // Convert signature from DER to raw format (r || s)
  const signatureArray = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64Url(signatureArray);
  
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
  };
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const vapidHeaders = await generateVapidHeaders(subscription.endpoint);
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeaders.authorization,
        'Crypto-Key': vapidHeaders.cryptoKey,
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error(`Push failed for ${subscription.endpoint}: ${response.status} ${response.statusText}`);
      // 404 or 410 means subscription is no longer valid
      if (response.status === 404 || response.status === 410) {
        return false; // Signal to delete this subscription
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error sending push:', error);
    return true; // Keep subscription on network errors
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received push notification request:', JSON.stringify(body));

    let targetUserIds: string[] = [];
    let notificationPayload: object;

    if (body.type === 'notification') {
      // Standard notification (like, comment, mention, follow)
      targetUserIds = [body.user_id];
      
      // Get actor info
      const { data: actor } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', body.actor_id)
        .single();
      
      const actorName = actor?.full_name || actor?.username || 'Qualcuno';
      
      let title = 'NoParrot';
      let messageBody = '';
      let url = '/notifications';
      
      switch (body.notification_type) {
        case 'like':
          title = 'Nuovo mi piace';
          messageBody = `${actorName} ha messo mi piace al tuo post`;
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'comment':
          title = 'Nuovo commento';
          messageBody = `${actorName} ha commentato il tuo post`;
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'mention':
          title = 'Nuova menzione';
          messageBody = `${actorName} ti ha menzionato`;
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'follow':
          title = 'Nuovo follower';
          messageBody = `${actorName} ha iniziato a seguirti`;
          url = `/user/${body.actor_id}`;
          break;
        default:
          messageBody = `${actorName} ha interagito con te`;
      }
      
      notificationPayload = {
        title,
        body: messageBody,
        icon: '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `notification-${body.notification_id}`,
        data: { url, type: 'notification' },
      };
      
    } else if (body.type === 'message') {
      // DM notification
      // Get all thread participants except sender
      const { data: participants } = await supabase
        .from('thread_participants')
        .select('user_id')
        .eq('thread_id', body.thread_id)
        .neq('user_id', body.sender_id);
      
      targetUserIds = participants?.map(p => p.user_id) || [];
      
      // Get sender info
      const { data: sender } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', body.sender_id)
        .single();
      
      const senderName = sender?.full_name || sender?.username || 'Qualcuno';
      const messagePreview = body.content?.length > 50 
        ? body.content.substring(0, 50) + '...' 
        : body.content;
      
      notificationPayload = {
        title: senderName,
        body: messagePreview || 'Ti ha inviato un messaggio',
        icon: sender?.avatar_url || '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `message-${body.thread_id}`,
        data: { url: `/messages/${body.thread_id}`, type: 'message' },
      };
      
    } else {
      return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetUserIds.length === 0) {
      console.log('No target users for this notification');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions for ${targetUserIds.length} users`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send push to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          notificationPayload
        );
        
        // Delete invalid subscriptions
        if (!success) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`Deleted invalid subscription: ${sub.id}`);
        }
        
        return success;
      })
    );

    const sentCount = results.filter(Boolean).length;
    console.log(`Successfully sent ${sentCount} push notifications`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});