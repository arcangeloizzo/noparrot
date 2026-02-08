import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a new valid VAPID key pair
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('[VAPID] Generated new key pair');
  
  return new Response(JSON.stringify({
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
    instructions: {
      step1: "Copy publicKey to frontend code (usePushNotifications.ts line 7)",
      step2: "Copy publicKey to backend code (send-push-notification/index.ts line 11)",
      step3: "Set privateKey as VAPID_PRIVATE_KEY secret",
      step4: "Delete all rows from push_subscriptions table",
      step5: "Re-subscribe to notifications in the app"
    }
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
