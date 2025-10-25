import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get userId from verified JWT
    const userId = user.id;

    const { postId, sourceUrl, answers, gateType } = await req.json();
    const startTime = Date.now();

    // Fetch correct answers from post_qa
    // Try with postId first
    let { data: qaData, error: qaError } = postId
      ? await supabase
          .from('post_qa')
          .select('correct_answers, generated_from')
          .eq('post_id', postId)
          .eq('source_url', sourceUrl || '')
          .maybeSingle()
      : await supabase
          .from('post_qa')
          .select('correct_answers, generated_from')
          .eq('source_url', sourceUrl || '')
          .is('post_id', null)
          .maybeSingle();

    // If not found, fallback to pre-publish records (post_id IS NULL)
    if (!qaData) {
      const { data: prePublishData, error: prePublishError } = await supabase
        .from('post_qa')
        .select('correct_answers, generated_from')
        .eq('source_url', sourceUrl || '')
        .is('post_id', null)
        .maybeSingle();
      
      qaData = prePublishData;
      qaError = prePublishError;
    }

    if (qaError || !qaData) {
      console.error('Q&A lookup failed:', { postId, sourceUrl, qaError });
      throw new Error('Q&A not found');
    }

    // Validate answers
    const correctAnswers = qaData.correct_answers;
    let score = 0;
    let errorCount = 0;
    const wrongIndexes: string[] = [];

    correctAnswers.forEach((correct: any) => {
      if (answers[correct.id] === correct.correctId) {
        score++;
      } else {
        errorCount++;
        wrongIndexes.push(correct.id);
      }
    });

    // LOGICA CORRETTA: massimo 1 errore E almeno 1 risposta corretta
    const passed = errorCount <= 1 && score >= 1;
    const completionTime = Date.now() - startTime;
    
    console.log(`Validation complete: ${score}/3 correct, ${errorCount} errors, passed: ${passed}`);

    // Save attempt to database with verified userId
    await supabase.from('post_gate_attempts').insert({
      user_id: userId,
      post_id: postId || null,
      source_url: sourceUrl || '',
      answers,
      passed,
      score,
      gate_type: gateType || 'share',
      provider: qaData.generated_from,
      completion_time_ms: completionTime
    });

    return new Response(
      JSON.stringify({ 
        passed, 
        score, 
        total: 3, 
        wrongIndexes,
        completionTime 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-answers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
