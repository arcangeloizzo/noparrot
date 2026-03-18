import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Check Rate Limit
    const { data: lastExport, error: logError } = await supabaseAdmin
      .from('export_logs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastExport) {
      const lastExportDate = new Date(lastExport.created_at);
      const hoursSinceLastExport = (new Date().getTime() - lastExportDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastExport < 24) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Puoi esportare i tuoi dati solo una volta ogni 24 ore." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Collect Data
    const [
      { data: profile },
      { data: posts },
      { data: voicePosts },
      { data: comments },
      { data: reactions },
      { data: messagesSent },
      { data: messagesReceived },
      { data: focusBookmarks },
      { data: challengeResponses },
      { data: consents },
      { data: cognitiveProfile },
      { data: reports }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.from('posts').select('*').eq('author_id', userId),
      supabaseAdmin.from('voice_posts').select('*').eq('author_id', userId),
      supabaseAdmin.from('comments').select('*').eq('author_id', userId),
      supabaseAdmin.from('reactions').select('*').eq('user_id', userId),
      supabaseAdmin.from('messages').select('*').eq('sender_id', userId),
      supabaseAdmin.from('messages').select('*').eq('receiver_id', userId),
      supabaseAdmin.from('focus_bookmarks').select('*').eq('user_id', userId),
      supabaseAdmin.from('challenge_responses').select('*').eq('author_id', userId),
      supabaseAdmin.from('user_consents').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('cognitive_profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('content_reports').select('*').eq('reporter_id', userId)
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      userInfo: {
        profile,
        consents,
        cognitiveProfile
      },
      content: {
        posts,
        voicePosts,
        comments
      },
      interactions: {
        reactions,
        focusBookmarks,
        challengeResponses
      },
      communications: {
        messagesSent,
        messagesReceived,
        reportsFiled: reports
      }
    };

    // 3. Log the export
    await supabaseAdmin.from('export_logs').insert({ user_id: userId });

    return new Response(
      JSON.stringify(exportData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Error in export-user-data function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});