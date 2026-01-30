import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS_PER_WINDOW = 10;

// ========================================================================
// INPUT VALIDATION UTILITIES
// ========================================================================

/**
 * Validates UUID format
 */
function isValidUuid(id: unknown): id is string {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates short IDs like "q1", "q2", "q3" and "a", "b", "c"
 * Used for questionId and choiceId in step mode
 */
function isValidShortId(id: unknown): id is string {
  if (!id || typeof id !== 'string') return false;
  // Question IDs: q1, q2, q3, q4, q5, etc.
  // Choice IDs: a, b, c, d
  return /^(q[1-9]|[a-d])$/i.test(id);
}

/**
 * Validates that answers object has proper structure for final mode
 * Keys are question IDs (q1, q2, q3), values are choice IDs (a, b, c)
 */
function validateAnswersObject(answers: unknown): answers is Record<string, string> {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  
  // Check all keys and values are valid short IDs
  for (const [key, value] of Object.entries(answers)) {
    if (!isValidShortId(key) || !isValidShortId(value)) {
      return false;
    }
  }
  
  return true;
}

/**
 * SUBMIT-QA Edge Function
 * 
 * Security hardened endpoint to validate quiz answers.
 * Supports two modes:
 * - "step": Validate single question, return only { isCorrect: boolean }
 * - "final" (default): Validate all answers, return { passed, score, total, wrongIndexes }
 * 
 * Privacy-safe: Never returns correct answers to client.
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

    const body = await req.json();
    const { qaId, sourceUrl, postId, answers, gateType, mode, questionId, choiceId } = body;

    // ========================================================================
    // INPUT VALIDATION - Validate all IDs before processing
    // ========================================================================
    
    // Validate qaId format if provided
    if (qaId && !isValidUuid(qaId)) {
      console.warn('[submit-qa] Invalid qaId format:', qaId);
      return new Response(
        JSON.stringify({ error: 'Invalid qaId format', code: 'INVALID_QA_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate postId format if provided
    if (postId && !isValidUuid(postId)) {
      console.warn('[submit-qa] Invalid postId format:', postId);
      return new Response(
        JSON.stringify({ error: 'Invalid postId format', code: 'INVALID_POST_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate questionId and choiceId for step mode (short IDs like q1, a, b, c)
    if (mode === 'step') {
      if (questionId && !isValidShortId(questionId)) {
        console.warn('[submit-qa] Invalid questionId format:', questionId, '- expected q1, q2, q3, etc.');
        return new Response(
          JSON.stringify({ error: 'Invalid questionId format', code: 'INVALID_QUESTION_ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (choiceId && !isValidShortId(choiceId)) {
        console.warn('[submit-qa] Invalid choiceId format:', choiceId, '- expected a, b, c, or d');
        return new Response(
          JSON.stringify({ error: 'Invalid choiceId format', code: 'INVALID_CHOICE_ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate gateType is one of allowed values
    const validGateTypes = ['share', 'comment', 'reshare', 'source', 'composer', 'message'];
    if (gateType && !validGateTypes.includes(gateType)) {
      console.warn('[submit-qa] Invalid gateType:', gateType);
      return new Response(
        JSON.stringify({ error: 'Invalid gateType', code: 'INVALID_GATE_TYPE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[submit-qa] Request:', { 
      qaId, 
      sourceUrl: sourceUrl?.substring(0, 50), 
      postId,
      gateType,
      mode: mode || 'final',
      userId: userId.substring(0, 8),
      ...(mode === 'step' ? { questionId, choiceId } : { answerCount: Object.keys(answers || {}).length })
    });

    // ===== MODE: STEP - Validate single question =====
    if (mode === 'step') {
      if (!qaId || !questionId || !choiceId) {
        return new Response(
          JSON.stringify({ error: 'Missing qaId, questionId, or choiceId for step mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch correct answers from private table
      const { data: answersData, error: answersError } = await supabase
        .from('post_qa_answers')
        .select('correct_answers')
        .eq('id', qaId)
        .maybeSingle();

      if (answersError || !answersData) {
        console.error('[submit-qa][step] Failed to fetch correct answers:', answersError);
        return new Response(
          JSON.stringify({ error: 'Quiz answers not found', code: 'ANSWERS_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const correctAnswers = answersData.correct_answers;
      
      if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
        console.error('[submit-qa][step] CRITICAL: correct_answers is empty or invalid');
        return new Response(
          JSON.stringify({ error: 'Quiz answers not properly configured', code: 'INVALID_ANSWER_KEYSET' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // FORENSIC LOGGING: Show exact values for debugging
      console.log('[submit-qa][step] ===== FORENSIC DEBUG =====');
      console.log('[submit-qa][step] qaId:', qaId);
      console.log('[submit-qa][step] questionId received:', JSON.stringify(questionId), 'type:', typeof questionId);
      console.log('[submit-qa][step] choiceId received:', JSON.stringify(choiceId), 'type:', typeof choiceId);
      console.log('[submit-qa][step] correctAnswers from DB:', JSON.stringify(correctAnswers));
      
      // Find the specific question's correct answer
      const correctAnswer = correctAnswers.find((c: any) => c.id === questionId);
      
      if (!correctAnswer) {
        console.error('[submit-qa][step] Question NOT FOUND in correctAnswers');
        console.error('[submit-qa][step] Available question IDs:', correctAnswers.map((c: any) => c.id));
        return new Response(
          JSON.stringify({ error: 'Question not found', code: 'QUESTION_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[submit-qa][step] Found correct answer record:', JSON.stringify(correctAnswer));
      console.log('[submit-qa][step] Comparing: submitted choiceId', JSON.stringify(choiceId), '=== correctId', JSON.stringify(correctAnswer.correctId));
      
      // Normalize both values to strings for safe comparison
      const normalizedSubmitted = String(choiceId).toLowerCase().trim();
      const normalizedCorrect = String(correctAnswer.correctId).toLowerCase().trim();
      const isCorrect = normalizedSubmitted === normalizedCorrect;
      
      console.log(`[submit-qa][step] RESULT: isCorrect = ${isCorrect}`);

      // Return ONLY isCorrect - no other information
      return new Response(
        JSON.stringify({ isCorrect }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== MODE: FINAL - Validate all answers =====
    if (!validateAnswersObject(answers)) {
      console.warn('[submit-qa] Invalid answers format or structure');
      return new Response(
        JSON.stringify({ error: 'Invalid answers format. All IDs must be valid UUIDs.', code: 'INVALID_ANSWERS_FORMAT' }),
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
    
    // SECURITY HARDENED: Fail-fast if correct_answers is empty or invalid
    if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
      console.error('[submit-qa] CRITICAL: correct_answers is empty or invalid', { 
        qaIdResolved, 
        hasAnswersRow: true, 
        correctAnswersType: typeof correctAnswers,
        correctAnswersLength: Array.isArray(correctAnswers) ? correctAnswers.length : 'N/A'
      });
      return new Response(
        JSON.stringify({ 
          error: 'Quiz answers not properly configured', 
          code: 'INVALID_ANSWER_KEYSET' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let score = 0;
    let errorCount = 0;
    const wrongIndexes: string[] = [];
    const totalQuestions = correctAnswers.length;

    // FORENSIC LOG: Compare submitted answers vs correct answers
    console.log('[submit-qa] FORENSIC validation:', {
      qaIdResolved,
      totalQuestions,
      submittedAnswerCount: Object.keys(answers).length,
      submittedAnswerKeys: Object.keys(answers),
      correctAnswerKeys: correctAnswers.map((c: any) => c.id),
    });

    correctAnswers.forEach((correct: any, index: number) => {
      const submitted = answers[correct.id];
      const expected = correct.correctId;
      
      // Normalize both values to strings for safe comparison
      const normalizedSubmitted = String(submitted || '').toLowerCase().trim();
      const normalizedExpected = String(expected || '').toLowerCase().trim();
      const isCorrect = normalizedSubmitted === normalizedExpected;
      
      // FORENSIC LOG: Per-question comparison
      console.log(`[submit-qa] Q${index + 1}:`, {
        questionId: correct.id,
        submitted,
        expected,
        normalizedSubmitted,
        normalizedExpected,
        isCorrect,
      });
      
      if (isCorrect) {
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
    
    console.log(`[submit-qa] FINAL RESULT: score=${score}/${totalQuestions}, errorCount=${errorCount}, maxAllowed=${maxAllowedErrors}, passed=${passed}`);

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
