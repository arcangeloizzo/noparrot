import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } =
      await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // ── Service role client ──
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Parse body ──
    const {
      challenge_id,
      audio_base64,
      stance,
      duration_seconds,
      waveform_data,
    } = await req.json();

    if (!challenge_id || !audio_base64 || !stance || !duration_seconds) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["for", "against"].includes(stance)) {
      return new Response(JSON.stringify({ error: "Invalid stance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Fetch challenge, verify active ──
    const { data: challenge, error: challengeErr } = await supabase
      .from("challenges")
      .select("id, post_id, status, expires_at")
      .eq("id", challenge_id)
      .single();

    if (challengeErr || !challenge) {
      return new Response(JSON.stringify({ error: "Challenge not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      challenge.status !== "active" ||
      new Date(challenge.expires_at) < new Date()
    ) {
      return new Response(JSON.stringify({ error: "Challenge expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Verify gate passed ──
    const { data: gateAttempt } = await supabase
      .from("post_gate_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", challenge.post_id)
      .eq("passed", true)
      .limit(1)
      .maybeSingle();

    // Gate check is soft — if post has no quiz (short content), gateAttempt may be null
    // The frontend already enforces the gate flow

    // ── 3. Check no existing response ──
    const { data: existingResp } = await supabase
      .from("challenge_responses")
      .select("id")
      .eq("challenge_id", challenge_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingResp) {
      return new Response(
        JSON.stringify({ error: "Already responded to this challenge" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 4. Upload audio ──
    const binaryStr = atob(audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const filePath = `${userId}/${challenge_id}_response.webm`;
    const { error: uploadErr } = await supabase.storage
      .from("voice-audio")
      .upload(filePath, bytes, {
        contentType: "audio/webm",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(JSON.stringify({ error: "Audio upload failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Create voice_posts record (null post_id — standalone) ──
    const { data: voicePost, error: vpErr } = await supabase
      .from("voice_posts")
      .insert({
        post_id: null,
        audio_url: filePath,
        duration_seconds,
        waveform_data: waveform_data || null,
        transcript_status: "pending",
      })
      .select("id")
      .single();

    if (vpErr || !voicePost) {
      console.error("voice_posts insert error:", vpErr);
      return new Response(
        JSON.stringify({ error: "Failed to create voice post" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 6. Create challenge_responses record ──
    const { data: challengeResp, error: crErr } = await supabase
      .from("challenge_responses")
      .insert({
        challenge_id,
        user_id: userId,
        voice_post_id: voicePost.id,
        stance,
        gate_passed: !!gateAttempt,
        argument_votes: 0,
      })
      .select("id")
      .single();

    if (crErr || !challengeResp) {
      console.error("challenge_responses insert error:", crErr);
      return new Response(
        JSON.stringify({ error: "Failed to create response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 7. Update challenge votes ──
    if (stance === "for") {
      await supabase.rpc("increment_post_shares", {
        target_post_id: challenge_id,
      }).catch(() => {});
      // Direct update instead
      await supabase
        .from("challenges")
        .update({
          votes_for: (challenge as any).votes_for
            ? (challenge as any).votes_for + 1
            : 1,
        })
        .eq("id", challenge_id);
    } else {
      await supabase
        .from("challenges")
        .update({
          votes_against: (challenge as any).votes_against
            ? (challenge as any).votes_against + 1
            : 1,
        })
        .eq("id", challenge_id);
    }

    // ── 8. Trigger transcription (fire-and-forget) ──
    try {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ voicePostId: voicePost.id }),
        }
      );
    } catch (e) {
      console.warn("transcribe-audio invocation failed (non-fatal):", e);
    }

    // ── 9. Insert notification in DB + send push (fire-and-forget) ──
    try {
      // Get the challenge post author
      const { data: challengePost } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", challenge.post_id)
        .single();

      if (challengePost && challengePost.author_id !== userId) {
        // Insert notification record so it appears in Notifications screen
        await supabase
          .from("notifications")
          .insert({
            user_id: challengePost.author_id,
            actor_id: userId,
            type: "challenge_response",
            post_id: challenge.post_id,
          });

        // The DB trigger on notifications will fire push automatically
      }
    } catch (e) {
      console.warn("Notification insert failed (non-fatal):", e);
    }

    // ── 10. Return response ──
    return new Response(
      JSON.stringify({ response_id: challengeResp.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("submit-challenge-response error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
