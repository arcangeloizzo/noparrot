import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS_PER_WINDOW = 10;

/**
 * SUBMIT-QA Edge Function
 * 
 * Security hardened endpoint to validate quiz answers.
 * - Requires valid JWT
 * - Validates answers server-side only
 * - Never returns correct answers to client
 * - Implements rate limiting
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
    const startTime = Date.now();

    const { qaId, sourceUrl, postId, answers, gateType } = await req.json();

    console.log('[submit-qa] Request:', { 
      qaId, 
      sourceUrl, 
      postId,
      gateType,
      userId: userId.substring(0, 8),
      answerCount: Object.keys(answers || {}).length 
    });

    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid answers format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the Q&A record
    let qaData: any = null;
    let qaIdResolved: string | null = qaId;

    // Strategy 1: Direct lookup by qaId
    if (qaId) {
      const { data, error } = await supabase
        .from('post_qa_questions')
        .select('id, expires_at, owner_id, source_url, post_id, generated_from')
        .eq('id', qaId)
        .maybeSingle();
      
      if (error) {
        console.error('[submit-qa] Lookup by qaId failed:', error);
      }
      qaData = data;
      qaIdResolved = data?.id;
    }

    // Strategy 2: Lookup by sourceUrl
    if (!qaData && sourceUrl) {
      if (postId) {
        const { data } = await supabase
          .from('post_qa_questions')
          .select('id, expires_at, owner_id, source_url, post_id, generated_from')
          .eq('source_url', sourceUrl)
          .eq('post_id', postId)
          .maybeSingle();
        qaData = data;
        qaIdResolved = data?.id;
      }

      if (!qaData) {
        const { data } = await supabase
          .from('post_qa_questions')
          .select('id, expires_at, owner_id, source_url, post_id, generated_from')
          .eq('source_url', sourceUrl)
          .is('post_id', null)
          .maybeSingle();
        qaData = data;
        qaIdResolved = data?.id;
      }
    }

    if (!qaData || !qaIdResolved) {
      console.log('[submit-qa] Q&A not found');
      return new Response(
        JSON.stringify({ error: 'Quiz not found', code: 'QA_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (qaData.expires_at && new Date(qaData.expires_at) < new Date()) {
      console.log('[submit-qa] Q&A expired');
      return new Response(
        JSON.stringify({ error: 'Quiz expired', code: 'QA_EXPIRED' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    
    const { data: rateData } = await supabase
      .from('qa_submit_attempts')
      .select('attempt_count, window_start, last_attempt_at')
      .eq('user_id', userId)
      .eq('qa_id', qaIdResolved)
      .maybeSingle();

    if (rateData) {
      const windowStartDate = new Date(rateData.window_start);
      
      // If within window, check limit
      if (windowStartDate > windowStart) {
        if (rateData.attempt_count >= MAX_ATTEMPTS_PER_WINDOW) {
          const retryAfter = Math.ceil((windowStartDate.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000);
          console.log('[submit-qa] Rate limit exceeded');
          return new Response(
            JSON.stringify({ 
              error: 'Too many attempts. Please try again later.',
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter
            }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Retry-After': retryAfter.toString()
              } 
            }
          );
        }
        
        // Increment counter
        await supabase
          .from('qa_submit_attempts')
          .update({ 
            attempt_count: rateData.attempt_count + 1,
            last_attempt_at: now.toISOString()
          })
          .eq('user_id', userId)
          .eq('qa_id', qaIdResolved);
      } else {
        // Window expired, reset
        await supabase
          .from('qa_submit_attempts')
          .update({ 
            attempt_count: 1,
            window_start: now.toISOString(),
            last_attempt_at: now.toISOString()
          })
          .eq('user_id', userId)
          .eq('qa_id', qaIdResolved);
      }
    } else {
      // First attempt
      await supabase
        .from('qa_submit_attempts')
        .insert({
          user_id: userId,
          qa_id: qaIdResolved,
          attempt_count: 1,
          window_start: now.toISOString(),
          last_attempt_at: now.toISOString()
        });
    }

    // Fetch correct answers from private table (service_role access)
    const { data: answersData, error: answersError } = await supabase
      .from('post_qa_answers')
      .select('correct_answers')
      .eq('id', qaIdResolved)
      .maybeSingle();

    if (answersError || !answersData) {
      console.error('[submit-qa] Failed to fetch correct answers:', answersError);
      return new Response(
        JSON.stringify({ error: 'Quiz answers not found', code: 'ANSWERS_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate answers server-side
    const correctAnswers = answersData.correct_answers;
    let score = 0;
    let errorCount = 0;
    const wrongIndexes: string[] = [];
    const totalQuestions = correctAnswers.length;

    correctAnswers.forEach((correct: any) => {
      if (answers[correct.id] === correct.correctId) {
        score++;
      } else {
        errorCount++;
        wrongIndexes.push(correct.id);
      }
    });

    // Pass logic: 
    // - 3 questions: max 1 error (at least 2/3 correct)
    // - 1 question: must be correct
    const maxAllowedErrors = totalQuestions === 1 ? 0 : 1;
    const passed = errorCount <= maxAllowedErrors;
    const completionTime = Date.now() - startTime;
    
    console.log(`[submit-qa] Result: ${score}/${totalQuestions} correct, passed: ${passed}`);

    // Log attempt to post_gate_attempts
    await supabase.from('post_gate_attempts').insert({
      user_id: userId,
      post_id: qaData.post_id || postId || null,
      source_url: qaData.source_url || sourceUrl || '',
      answers,
      passed,
      score,
      gate_type: gateType || 'share',
      provider: qaData.generated_from,
      completion_time_ms: completionTime
    });

    // Return result - NEVER include correct answers
    return new Response(
      JSON.stringify({ 
        passed, 
        score, 
        total: totalQuestions,
        wrongIndexes,
        completionTime
        // NO correctAnswers, NO explanations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-qa] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred processing your request',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
