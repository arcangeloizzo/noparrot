import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID Configuration
const VAPID_PUBLIC_KEY = 'BBZe7cI-AdlX4-6YWLqaI6qbwIsi9JZ-c2zQT2Ay5DdMFFtlUIIad_JpRkecMOJRqJpwxx-UeEQ8Axst9t9I9Gk';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

// Configure web-push with VAPID details
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Validate authorization: service role key OR valid user JWT
async function validateAuth(req: Request, supabaseClient: any): Promise<{ isServiceRole: true } | { isServiceRole: false; userId: string } | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');

  // 1. Check if it's the SERVICE_ROLE_KEY (internal DB trigger / server-to-server)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey.length > 20 && token === serviceKey) {
    return { isServiceRole: true };
  }

  // 2. Check if it's a valid user JWT
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) return null;
    return { isServiceRole: false, userId: data.user.id };
  } catch {
    return null;
  }
}

// Input validation for notification types
function validateNotificationType(type: string): boolean {
  const validTypes = ['notification', 'message', 'editorial', 'admin'];
  return validTypes.includes(type);
}

function validateUUID(id: string | undefined | null): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Map notification type to profile preference field
const notificationTypeToField: Record<string, string> = {
  'like': 'notifications_likes_enabled',
  'comment': 'notifications_comments_enabled',
  'mention': 'notifications_mentions_enabled',
  'follow': 'notifications_follows_enabled',
  'reshare': 'notifications_reshares_enabled',
  'message_like': 'notifications_likes_enabled',
};

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      }
    };

    console.log(`[Push] Sending to: ${subscription.endpoint.slice(0, 60)}...`);

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400,
        urgency: 'high'
      }
    );

    console.log(`[Push] Successfully sent to ${subscription.endpoint.slice(0, 50)}...`);
    return true;
  } catch (error: any) {
    console.error(`[Push] Failed: ${error.statusCode || 'unknown'} - ${error.body || error.message}`);

    // 403, 404, 410 = subscription is invalid, should be deleted
    if (error.statusCode === 403 || error.statusCode === 404 || error.statusCode === 410) {
      return false;
    }
    // Keep subscription on other errors (network issues, etc.)
    return true;
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

    // Security: Validate authorization (service role or authenticated user)
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

    // Only service role can send editorial/admin notifications
    if ((body.type === 'editorial' || body.type === 'admin') && !authContext.isServiceRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: elevated permissions required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent user impersonation on message notifications
    if (body.type === 'message' && !authContext.isServiceRole) {
      if (body.sender_id !== (authContext as { userId: string }).userId) {
        return new Response(JSON.stringify({ error: 'Forbidden: cannot impersonate sender' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Input validation
    if (!body.type || !validateNotificationType(body.type)) {
      console.error('[Push] Invalid notification type:', body.type);
      return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUIDs based on notification type
    if (body.type === 'notification') {
      if (!validateUUID(body.user_id)) {
        return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (body.actor_id && !validateUUID(body.actor_id)) {
        return new Response(JSON.stringify({ error: 'Invalid actor_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (body.type === 'message') {
      if (!validateUUID(body.thread_id) || !validateUUID(body.sender_id)) {
        return new Response(JSON.stringify({ error: 'Invalid thread_id or sender_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let targetUserIds: string[] = [];
    let notificationPayload: object;

    if (body.type === 'notification') {
      // Check user notification preferences BEFORE sending
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
        } else if (profile && profile[preferenceField] === false) {
          console.log(`[Push] User ${body.user_id} has disabled ${notificationType} notifications - skipping`);
          return new Response(JSON.stringify({ success: true, sent: 0, reason: 'disabled_by_user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      targetUserIds = [body.user_id];

      // Get actor info
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
          // Fetch thread_id from message
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
      // DM notification - check user preference first
      const { data: participants } = await supabase
        .from('thread_participants')
        .select('user_id')
        .eq('thread_id', body.thread_id)
        .neq('user_id', body.sender_id);

      const potentialUserIds = participants?.map(p => p.user_id) || [];

      // Check message notification preferences for each user
      if (potentialUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, notifications_messages_enabled')
          .in('id', potentialUserIds);

        // Filter to only users who have messages enabled (or default true)
        targetUserIds = potentialUserIds.filter(userId => {
          const profile = profiles?.find(p => p.id === userId);
          return profile?.notifications_messages_enabled !== false;
        });

        const skipped = potentialUserIds.length - targetUserIds.length;
        if (skipped > 0) {
          console.log(`[Push] Skipping ${skipped} users who disabled message notifications`);
        }
      }

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
      // Editorial notification - broadcast only to users who have it enabled
      const { data: enabledProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('editorial_notifications_enabled', true);

      const enabledUserIds = enabledProfiles?.map(p => p.id) || [];

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

      targetUserIds = [...new Set(userSubscriptions?.map(s => s.user_id) || [])];

      console.log(`[Push] Editorial broadcast to ${targetUserIds.length} users (${enabledUserIds.length} enabled, ${userSubscriptions?.length || 0} subscriptions)`);

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
      // Admin notification for new user registration
      console.log('[Push] Processing admin new_user notification');

      // Get all admin user IDs
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminUserIds = adminRoles?.map(r => r.user_id) || [];

      if (adminUserIds.length === 0) {
        console.log('[Push] No admins found');
        return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_admins' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get new user info
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

    // Get all push subscriptions for target users
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
