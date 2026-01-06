import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * DEPRECATED: validate-answers Edge Function
 * 
 * This endpoint has been deprecated in favor of submit-qa.
 * All validation should now go through submit-qa for security hardening.
 * 
 * Returns 410 Gone to signal clients to migrate.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log deprecation warning
  console.warn('[validate-answers] DEPRECATED: This endpoint is no longer active. Use submit-qa instead.');

  return new Response(
    JSON.stringify({ 
      error: 'Deprecated',
      code: 'DEPRECATED_ENDPOINT',
      message: 'This endpoint has been deprecated. Use submit-qa instead.'
    }),
    { 
      status: 410, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
