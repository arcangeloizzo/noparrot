import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📦 [export-user-data] Exporting data for user: ${user.id}`);

    // Fetch all user data in parallel
    const [
      profileResult,
      postsResult,
      commentsResult,
      gateAttemptsResult,
      consentsResult,
      reactionsResult,
      focusBookmarksResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, full_name, bio, avatar_url, cognitive_density, cognitive_tracking_enabled, date_of_birth, created_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("posts")
        .select("id, content, category, topic_tag, shared_url, shared_title, created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, content, post_id, created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("post_gate_attempts")
        .select("id, post_id, source_url, gate_type, score, passed, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_consents")
        .select("accepted_terms, accepted_privacy, ads_personalization_opt_in, consent_version, created_at, updated_at")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("reactions")
        .select("id, post_id, reaction_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("focus_bookmarks")
        .select("id, focus_id, focus_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_email: user.email,
      profile: profileResult.data || null,
      posts: postsResult.data || [],
      comments: commentsResult.data || [],
      reactions: reactionsResult.data || [],
      gate_attempts: gateAttemptsResult.data || [],
      focus_bookmarks: focusBookmarksResult.data || [],
      consents: consentsResult.data || null,
      metadata: {
        total_posts: postsResult.data?.length || 0,
        total_comments: commentsResult.data?.length || 0,
        total_reactions: reactionsResult.data?.length || 0,
        total_gate_attempts: gateAttemptsResult.data?.length || 0,
      },
    };

    console.log(`✅ [export-user-data] Export complete: ${exportData.metadata.total_posts} posts, ${exportData.metadata.total_comments} comments`);

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="noparrot-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("❌ [export-user-data] Error:", error);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
