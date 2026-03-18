import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Creating a supabase client with the Auth header to verify the user
    // But we need the Service Role Key to delete the user from auth.users
    // Default supabase client for validating the token:
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized or token invalid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Service Role Client for bypassing RLS and doing hard deletes + auth admin deletes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Starting cascade deletion for user ${userId}`);

    // Since deleting auth.users doesn't consistently cascade to all tables (e.g. cognitive_profiles)
    // we explicitly delete from known related tables first

    // 1. Delete comments and comment reactions
    await supabaseAdmin.from('comment_reactions').delete().eq('user_id', userId);
    await supabaseAdmin.from('comments').delete().eq('author_id', userId);
    await supabaseAdmin.from('comment_cognitive_metrics').delete().eq('user_id', userId);

    // 2. Delete posts and post reactions
    await supabaseAdmin.from('reactions').delete().eq('user_id', userId);
    await supabaseAdmin.from('posts').delete().eq('author_id', userId);

    // 3. Delete related interactive data
    await supabaseAdmin.from('focus_bookmarks').delete().eq('user_id', userId);
    await supabaseAdmin.from('post_qa_answers').delete().eq('user_id', userId);
    await supabaseAdmin.from('challenge_responses').delete().eq('author_id', userId);
    await supabaseAdmin.from('challenge_votes').delete().eq('user_id', userId);
    await supabaseAdmin.from('qa_submit_attempts').delete().eq('user_id', userId);

    // 4. Delete messaging and reports
    await supabaseAdmin.from('messages').delete().eq('sender_id', userId);
    await supabaseAdmin.from('content_reports').delete().eq('reporter_id', userId);
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId);

    // 5. Delete profile data
    await supabaseAdmin.from('cognitive_profiles').delete().eq('id', userId);
    await supabaseAdmin.from('user_consents').delete().eq('id', userId);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 6. Delete the user from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      throw deleteAuthError;
    }

    console.log(`Successfully deleted user ${userId} and all related data.`);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Error in delete-user-data function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
