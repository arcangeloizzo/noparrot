import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// HMAC TELEMETRY HELPERS
// ============================================================================
async function hashUserId(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(userId));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

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
    userHash?: string;
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
      error_code: params.errorCode || null,
      user_hash: params.userHash || null
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
    const { text, title, summary } = await req.json();
    
    // Initialize Supabase for telemetry
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Combina tutte le informazioni disponibili per la classificazione
    const contentToClassify = [title, text, summary].filter(Boolean).join('\n\n');
    const inputChars = contentToClassify.length;

    const systemPrompt = `Sei un sistema di classificazione di contenuti. Devi classificare il contenuto fornito in UNA SOLA delle seguenti macro-categorie:

- Società & Politica
- Economia & Business
- Scienza & Tecnologia
- Cultura & Arte
- Pianeta & Ambiente
- Sport & Lifestyle
- Salute & Benessere
- Media & Comunicazione

Rispondi SOLO con il nome della categoria, nient'altro.`;

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
          { role: 'user', content: contentToClassify }
        ],
        temperature: 0.3,
      }),
    });

    const providerLatencyMs = Date.now() - aiStartTime;

    if (!response.ok) {
      const errorText = await response.text();
      
      await logAiUsage(supabase, {
        functionName: 'classify-content',
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
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const category = data.choices[0].message.content.trim();
    const outputChars = category.length;

    // Log successful AI call
    await logAiUsage(supabase, {
      functionName: 'classify-content',
      model: 'google/gemini-2.5-flash',
      inputChars,
      outputChars,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      providerLatencyMs,
      success: true
    });

    console.log('[classify-content] Classified as:', category);

    return new Response(
      JSON.stringify({ category }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in classify-content:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});