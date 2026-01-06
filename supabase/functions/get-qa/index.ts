import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GET-QA Edge Function
 * 
 * Security hardened endpoint to retrieve quiz questions.
 * - Requires valid JWT
 * - Returns ONLY questions (no correct_answers)
 * - Validates ownership OR allows access if Q&A is tied to a public post
 * - Rejects expired Q&A with 410 Gone
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const { qaId, sourceUrl, postId } = await req.json();

    console.log('[get-qa] Request:', { qaId, sourceUrl, postId, userId: userId.substring(0, 8) });

    let qaData: any = null;

    // Strategy 1: Direct lookup by qaId
    if (qaId) {
      const { data, error } = await supabase
        .from('post_qa_questions')
        .select('id, questions, test_mode, generated_at, expires_at, owner_id, source_url, post_id')
        .eq('id', qaId)
        .maybeSingle();
      
      if (error) {
        console.error('[get-qa] Lookup by qaId failed:', error);
      }
      qaData = data;
    }

    // Strategy 2: Lookup by sourceUrl (for pre-publish or shared gates)
    if (!qaData && sourceUrl) {
      // Try with postId first if provided
      if (postId) {
        const { data } = await supabase
          .from('post_qa_questions')
          .select('id, questions, test_mode, generated_at, expires_at, owner_id, source_url, post_id')
          .eq('source_url', sourceUrl)
          .eq('post_id', postId)
          .maybeSingle();
        qaData = data;
      }

      // Fallback to pre-publish records (post_id IS NULL)
      if (!qaData) {
        const { data } = await supabase
          .from('post_qa_questions')
          .select('id, questions, test_mode, generated_at, expires_at, owner_id, source_url, post_id')
          .eq('source_url', sourceUrl)
          .is('post_id', null)
          .maybeSingle();
        qaData = data;
      }
    }

    if (!qaData) {
      console.log('[get-qa] Q&A not found');
      return new Response(
        JSON.stringify({ error: 'Quiz not found', code: 'QA_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (qaData.expires_at && new Date(qaData.expires_at) < new Date()) {
      console.log('[get-qa] Q&A expired');
      return new Response(
        JSON.stringify({ error: 'Quiz expired', code: 'QA_EXPIRED' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Access control:
    // 1. Owner always has access
    // 2. If Q&A is tied to a post, anyone can access (for share gates)
    // 3. Pre-publish Q&A (no post_id) - only owner can access
    const isOwner = qaData.owner_id === userId;
    const isPublicPost = qaData.post_id !== null;
    
    if (!isOwner && !isPublicPost) {
      console.log('[get-qa] Access denied - not owner and not public post');
      return new Response(
        JSON.stringify({ error: 'Access denied', code: 'ACCESS_DENIED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strip correctId from questions before returning
    const sanitizedQuestions = qaData.questions.map((q: any) => ({
      id: q.id,
      stem: q.stem,
      choices: q.choices.map((c: any) => ({
        id: c.id,
        text: c.text
      }))
      // correctId is NOT included
    }));

    console.log('[get-qa] Success, returning', sanitizedQuestions.length, 'questions');

    return new Response(
      JSON.stringify({
        qaId: qaData.id,
        questions: sanitizedQuestions,
        testMode: qaData.test_mode,
        generatedAt: qaData.generated_at,
        expiresAt: qaData.expires_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-qa] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred processing your request',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
