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
    const { postId, sourceUrl, answers, userId, gateType } = await req.json();
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const wrongIndexes: string[] = [];

    correctAnswers.forEach((correct: any) => {
      if (answers[correct.id] === correct.correctId) {
        score++;
      } else {
        wrongIndexes.push(correct.id);
      }
    });

    const passed = score >= 2; // Pass with 2/3 correct
    const completionTime = Date.now() - startTime;

    // Save attempt to database
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

    console.log(`Validation complete: ${score}/3 correct, passed: ${passed}`);

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
