import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Custom token-based authentication
    const adminToken = req.headers.get('x-admin-token');
    const expectedToken = Deno.env.get('CLEANUP_ADMIN_TOKEN');

    if (!expectedToken || adminToken !== expectedToken) {
      console.log('Unauthorized: invalid or missing x-admin-token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service_role internally only for Supabase client
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();
    const results = {
      content_cache: 0,
      youtube_transcripts_cache: 0,
      trust_scores: 0
    };

    console.log(`Starting cleanup at ${now}`);

    // Cleanup content_cache (expires_at < now)
    const { data: ccData, error: ccError } = await supabase
      .from('content_cache')
      .delete()
      .lt('expires_at', now)
      .select('source_url');
    
    if (ccError) {
      console.error('Error cleaning content_cache:', ccError);
    } else {
      results.content_cache = ccData?.length || 0;
      console.log(`Deleted ${results.content_cache} expired records from content_cache`);
    }

    // Cleanup youtube_transcripts_cache (expires_at < now)
    const { data: ytData, error: ytError } = await supabase
      .from('youtube_transcripts_cache')
      .delete()
      .lt('expires_at', now)
      .select('video_id');
    
    if (ytError) {
      console.error('Error cleaning youtube_transcripts_cache:', ytError);
    } else {
      results.youtube_transcripts_cache = ytData?.length || 0;
      console.log(`Deleted ${results.youtube_transcripts_cache} expired records from youtube_transcripts_cache`);
    }

    // Cleanup trust_scores (expires_at < now)
    const { data: tsData, error: tsError } = await supabase
      .from('trust_scores')
      .delete()
      .lt('expires_at', now)
      .select('source_url');
    
    if (tsError) {
      console.error('Error cleaning trust_scores:', tsError);
    } else {
      results.trust_scores = tsData?.length || 0;
      console.log(`Deleted ${results.trust_scores} expired records from trust_scores`);
    }

    const totalDeleted = results.content_cache + results.youtube_transcripts_cache + results.trust_scores;
    console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: results,
        total: totalDeleted,
        timestamp: now
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
