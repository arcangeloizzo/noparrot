import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// VAPID Configuration
const VAPID_PUBLIC_KEY = 'BBZe7cI-AdlX4-6YWLqaI6qbwIsi9JZ-c2zQT2Ay5DdMFFtlUIIad_JpRkecMOJRqJpwxx-UeEQ8Axst9t9I9Gk';

// ============= NATIVE WEB PUSH IMPLEMENTATION =============

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function importVapidPrivateKey(base64UrlPrivateKey: string): Promise<CryptoKey> {
  const rawPrivateKey = base64UrlDecode(base64UrlPrivateKey);
  // Build PKCS8 wrapper for raw 32-byte EC private key
  // This is the standard DER encoding for P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  const publicKeyBytes = base64UrlDecode(VAPID_PUBLIC_KEY);
  const pkcs8 = concatUint8(pkcs8Header, rawPrivateKey, pkcs8Footer, publicKeyBytes);

  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for JWT
  const derSig = new Uint8Array(signature);
  const rawSig = derToRaw(derSig);

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER format: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  if (der[0] !== 0x30) return der; // Already raw?

  let offset = 2; // Skip 0x30 and total length

  // Parse r
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset]; offset++;
  let r = der.slice(offset, offset + rLen); offset += rLen;

  // Parse s
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset]; offset++;
  let s = der.slice(offset, offset + sLen);

  // Remove leading zero padding and pad to 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);

  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

// ============= WEB PUSH ENCRYPTION (RFC 8291) =============

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(payload);

  // Import subscriber's public key
  const subscriberPubBytes = base64UrlDecode(p256dhKey);
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPubBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Generate ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export local public key
  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Auth secret
  const authBytes = base64UrlDecode(authSecret);

  // HKDF to derive IKM (RFC 8291 Section 3.3)
  const authInfo = concatUint8(
    encoder.encode('WebPush: info\0'),
    subscriberPubBytes,
    localPubRaw
  );

  const ikm = await hkdfDerive(authBytes, sharedSecret, authInfo, 32);

  // Derive content encryption key and nonce
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');

  const cek = await hkdfDerive(salt, ikm, cekInfo, 16);
  const nonce = await hkdfDerive(salt, ikm, nonceInfo, 12);

  // Pad plaintext (RFC 8188): add 1 byte delimiter + optional padding
  const paddedPlaintext = concatUint8(plaintext, new Uint8Array([2])); // \x02 = final record

  // AES-128-GCM encrypt
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      paddedPlaintext
    )
  );

  // Build aes128gcm content coding header (RFC 8188)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, paddedPlaintext.length + 16); // +16 for tag
  const idLen = new Uint8Array([65]); // key ID length = 65 (public key)

  const header = concatUint8(salt, recordSize, idLen, localPubRaw);
  const encrypted = concatUint8(header, ciphertext);

  return { encrypted, localPublicKey: localPubRaw };
}

async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// ============= SEND PUSH NOTIFICATION =============

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

    // Get audience from endpoint
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    // Import VAPID key and create JWT
    const privateKey = await importVapidPrivateKey(vapidPrivateKey);
    const jwt = await createVapidJwt(audience, vapidSubject, privateKey);

    // Encrypt payload
    const payloadStr = JSON.stringify(payload);
    const { encrypted } = await encryptPayload(
      payloadStr,
      subscription.p256dh,
      subscription.auth
    );

    console.log(`[Push] Sending to: ${subscription.endpoint.slice(0, 60)}...`);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      console.log(`[Push] Successfully sent to ${subscription.endpoint.slice(0, 50)}...`);
      return true;
    }

    const responseText = await response.text();
    console.error(`[Push] Failed: ${response.status} - ${responseText}`);

    // 400 (VapidPkHashMismatch), 403, 404, 410 = subscription is invalid/stale, should be deleted
    if (response.status === 400 || response.status === 403 || response.status === 404 || response.status === 410) {
      console.log(`[Push] Marking subscription for cleanup (status ${response.status}): ${subscription.endpoint.slice(0, 50)}...`);
      return false;
    }
    // Keep subscription on other errors (network issues, server errors, etc.)
    return true;
  } catch (error: any) {
    console.error(`[Push] Error: ${error.message}`);
    return true; // Keep subscription on unexpected errors
  }
}

// ============= AUTH & VALIDATION (unchanged) =============

async function validateAuth(req: Request, supabaseClient: any): Promise<{ isServiceRole: true } | { isServiceRole: false; userId: string } | null> {
  // 1. Check x-internal-secret header (for database triggers)
  const internalSecret = req.headers.get('x-internal-secret') || '';
  const expectedSecret = Deno.env.get('PUSH_INTERNAL_SECRET') || '';
  if (expectedSecret.length > 10 && internalSecret === expectedSecret) {
    console.log('[Push] Authenticated via internal secret (trigger)');
    return { isServiceRole: true };
  }

  // 2. Check Bearer token (service role key or user JWT)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey.length > 20 && token === serviceKey) {
    return { isServiceRole: true };
  }

  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) return null;
    return { isServiceRole: false, userId: data.user.id };
  } catch {
    return null;
  }
}

function validateNotificationType(type: string): boolean {
  const validTypes = ['notification', 'message', 'editorial', 'admin'];
  return validTypes.includes(type);
}

function validateUUID(id: string | undefined | null): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

const notificationTypeToField: Record<string, string> = {
  'like': 'notifications_likes_enabled',
  'comment': 'notifications_comments_enabled',
  'mention': 'notifications_mentions_enabled',
  'follow': 'notifications_follows_enabled',
  'reshare': 'notifications_reshares_enabled',
  'message_like': 'notifications_likes_enabled',
};

// ============= MAIN HANDLER (business logic unchanged) =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authContext = await validateAuth(req, supabase);
    if (!authContext) {
      console.warn('[Push] ❌ Unauthorized request rejected');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('[Push] Received request:', JSON.stringify(body));

    if ((body.type === 'editorial' || body.type === 'admin') && !authContext.isServiceRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: elevated permissions required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.type === 'message' && !authContext.isServiceRole) {
      if (body.sender_id !== (authContext as { userId: string }).userId) {
        return new Response(JSON.stringify({ error: 'Forbidden: cannot impersonate sender' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!body.type || !validateNotificationType(body.type)) {
      console.error('[Push] Invalid notification type:', body.type);
      return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.type === 'notification') {
      if (!validateUUID(body.user_id)) {
        return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (body.actor_id && !validateUUID(body.actor_id)) {
        return new Response(JSON.stringify({ error: 'Invalid actor_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (body.type === 'message') {
      if (!validateUUID(body.thread_id) || !validateUUID(body.sender_id)) {
        return new Response(JSON.stringify({ error: 'Invalid thread_id or sender_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let targetUserIds: string[] = [];
    let notificationPayload: object;

    if (body.type === 'notification') {
      const notificationType = body.notification_type;
      const preferenceField = notificationTypeToField[notificationType];

      if (preferenceField) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(preferenceField)
          .eq('id', body.user_id)
          .single();

        if (profileError) {
          console.error('[Push] Error fetching user preferences:', profileError);
        } else if (profile && (profile as any)[preferenceField] === false) {
          console.log(`[Push] User ${body.user_id} has disabled ${notificationType} notifications - skipping`);
          return new Response(JSON.stringify({ success: true, sent: 0, reason: 'disabled_by_user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      targetUserIds = [body.user_id];

      const { data: actor } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', body.actor_id)
        .single();

      const actorName = actor?.full_name || actor?.username || 'Qualcuno';

      let title = 'NoParrot';
      let url = '/notifications';

      switch (body.notification_type) {
        case 'like':
          if (body.comment_id) {
            title = `${actorName} ha messo like al tuo commento`;
          } else {
            title = `${actorName} ha messo like al tuo post`;
          }
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'comment':
          title = `${actorName} ha commentato il tuo post`;
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'mention':
          if (body.comment_id) {
            title = `${actorName} ti ha taggato in un commento`;
          } else {
            title = `${actorName} ti ha taggato in un post`;
          }
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'follow':
          title = `${actorName} ha iniziato a seguirti`;
          url = `/profile/${body.actor_id}`;
          break;
        case 'reshare':
          title = `${actorName} ha condiviso il tuo post`;
          url = body.post_id ? `/post/${body.post_id}` : '/notifications';
          break;
        case 'message_like':
          title = `${actorName} ha messo like al tuo messaggio`;
          if (body.message_id) {
            const { data: msg } = await supabase
              .from('messages')
              .select('thread_id')
              .eq('id', body.message_id)
              .single();
            url = msg?.thread_id
              ? `/messages/${msg.thread_id}?scrollTo=${body.message_id}`
              : '/messages';
          } else {
            url = '/messages';
          }
          break;
        default:
          title = `${actorName} ha interagito con te`;
      }

      notificationPayload = {
        title,
        body: '',
        icon: '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `notification-${body.notification_id}`,
        data: { url, type: 'notification' },
      };

    } else if (body.type === 'message') {
      const { data: participants } = await supabase
        .from('thread_participants')
        .select('user_id')
        .eq('thread_id', body.thread_id)
        .neq('user_id', body.sender_id);

      const potentialUserIds = participants?.map((p: any) => p.user_id) || [];

      if (potentialUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, notifications_messages_enabled')
          .in('id', potentialUserIds);

        targetUserIds = potentialUserIds.filter((userId: string) => {
          const profile = profiles?.find((p: any) => p.id === userId);
          return profile?.notifications_messages_enabled !== false;
        });

        const skipped = potentialUserIds.length - targetUserIds.length;
        if (skipped > 0) {
          console.log(`[Push] Skipping ${skipped} users who disabled message notifications`);
        }
      }

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
        title: `${senderName} ti ha inviato un messaggio`,
        body: messagePreview || '',
        icon: sender?.avatar_url || '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `message-${body.thread_id}-${body.message_id}`,
        data: {
          url: `/messages/${body.thread_id}`,
          type: 'message',
          messageId: body.message_id
        },
      };

    } else if (body.type === 'editorial') {
      const { data: enabledProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('editorial_notifications_enabled', true);

      const enabledUserIds = enabledProfiles?.map((p: any) => p.id) || [];

      if (enabledUserIds.length === 0) {
        console.log('[Push] No users have editorial notifications enabled');
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: userSubscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .in('user_id', enabledUserIds);

      targetUserIds = [...new Set(userSubscriptions?.map((s: any) => s.user_id) || [])];

      console.log(`[Push] Editorial broadcast to ${targetUserIds.length} users`);

      notificationPayload = {
        title: '◉ Il Punto',
        body: body.editorial_title || 'Nuovo editoriale disponibile',
        icon: '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `editorial-${body.editorial_id}`,
        data: {
          url: `/?focus=${body.editorial_id}`,
          type: 'editorial'
        },
      };

    } else if (body.type === 'admin' && body.notification_type === 'new_user') {
      console.log('[Push] Processing admin new_user notification');

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminUserIds = adminRoles?.map((r: any) => r.user_id) || [];

      if (adminUserIds.length === 0) {
        console.log('[Push] No admins found');
        return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_admins' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', body.actor_id)
        .single();

      const newUserName = actorProfile?.full_name || actorProfile?.username?.replace(/@gmail\.com$/, '') || 'Nuovo utente';

      targetUserIds = adminUserIds;

      console.log(`[Push] Admin new_user notification to ${targetUserIds.length} admins for user: ${newUserName}`);

      notificationPayload = {
        title: '👤 Nuovo Utente Registrato',
        body: `${newUserName} si è appena iscritto a NoParrot`,
        icon: '/lovable-uploads/feed-logo.png',
        badge: '/lovable-uploads/feed-logo.png',
        tag: `new-user-${body.actor_id}`,
        data: {
          url: `/user/${body.actor_id}`,
          type: 'new_user'
        },
      };

    } else {
      return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetUserIds.length === 0) {
      console.log('[Push] No target users for this notification');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('[Push] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`[Push] Found ${subscriptions?.length || 0} subscriptions for ${targetUserIds.length} users`);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No subscriptions found for target users');
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(
      subscriptions.map(async (sub: any) => {
        const success = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          notificationPayload
        );

        if (!success) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`[Push] Deleted invalid subscription: ${sub.id}`);
        }

        return success;
      })
    );

    const sentCount = results.filter(Boolean).length;
    console.log(`[Push] Successfully sent ${sentCount} push notifications`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Push] Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
