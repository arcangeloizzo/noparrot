import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// HMAC TELEMETRY HELPERS
// ============================================================================
async function logAiUsage(
  supabase: any,
  params: {
    functionName: string;
    model: string;
    inputChars: number;
    outputChars: number;
    cacheHit: boolean;
    latencyMs: number;
    providerLatencyMs?: number;
    success: boolean;
    errorCode?: string;
  }
) {
  try {
    await supabase.from('ai_usage_logs').insert({
      function_name: params.functionName,
      model: params.model,
      input_chars: params.inputChars,
      output_chars: params.outputChars,
      cache_hit: params.cacheHit,
      latency_ms: params.latencyMs,
      provider_latency_ms: params.providerLatencyMs || null,
      success: params.success,
      error_code: params.errorCode || null
    });
  } catch (e) {
    console.error('[Telemetry] Failed to log:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { category, contents } = await req.json();
    
    // Initialize Supabase for telemetry
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!category || !contents || contents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Category and contents are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare content sample (limit to avoid token limits)
    const contentSample = contents.slice(0, 10).join('\n---\n');
    const inputChars = contentSample.length;

    const systemPrompt = `Sei un analista esperto che crea mini-focus intelligenti su discussioni online.
Analizza i contenuti forniti e genera un riassunto conciso (max 2-3 frasi) che risponde a:
1. Di cosa si parla principalmente?
2. Quali sono i temi caldi o controversi?
3. Che tono ha la discussione? (critico, ottimista, preoccupato, ecc.)

Sii specifico e concreto. Evita frasi generiche. Cita argomenti specifici se presenti.`;

    const userPrompt = `Categoria: ${category}

Contenuti recenti della community:
${contentSample}

Genera un mini-focus intelligente sulla discussione in corso.`;

    console.log(`[generate-trending-summary] Generating summary for category: ${category}`);

    const aiStartTime = Date.now();
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const providerLatencyMs = Date.now() - aiStartTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-trending-summary] AI gateway error:', response.status, errorText);
      
      await logAiUsage(supabase, {
        functionName: 'generate-trending-summary',
        model: 'google/gemini-2.5-flash',
        inputChars,
        outputChars: 0,
        cacheHit: false,
        latencyMs: Date.now() - startTime,
        providerLatencyMs,
        success: false,
        errorCode: `HTTP_${response.status}`
      });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', fallback: true }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', fallback: true }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'AI service error', fallback: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';
    const outputChars = summary.length;

    if (!summary) {
      console.error('[generate-trending-summary] Empty summary received');
      
      await logAiUsage(supabase, {
        functionName: 'generate-trending-summary',
        model: 'google/gemini-2.5-flash',
        inputChars,
        outputChars: 0,
        cacheHit: false,
        latencyMs: Date.now() - startTime,
        providerLatencyMs,
        success: false,
        errorCode: 'EMPTY_RESPONSE'
      });
      
      return new Response(
        JSON.stringify({ error: 'Empty summary', fallback: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful AI call
    await logAiUsage(supabase, {
      functionName: 'generate-trending-summary',
      model: 'google/gemini-2.5-flash',
      inputChars,
      outputChars,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      providerLatencyMs,
      success: true
    });

    console.log(`[generate-trending-summary] Generated summary for ${category}: ${summary.substring(0, 50)}...`);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-trending-summary] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});