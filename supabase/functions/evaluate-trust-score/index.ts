// supabase/functions/evaluate-trust-score/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TRUSTED DOMAINS WHITELIST - Skip AI for these known sources
// ============================================================================
const TRUSTED_DOMAINS: Record<string, { band: 'ALTO' | 'MEDIO'; score: number; reasons: string[] }> = {
  // Testate giornalistiche nazionali italiane
  'repubblica.it': { band: 'ALTO', score: 90, reasons: ['Testata giornalistica nazionale', 'Iscrizione ROC'] },
  'corriere.it': { band: 'ALTO', score: 90, reasons: ['Testata giornalistica nazionale', 'Iscrizione ROC'] },
  'ilsole24ore.com': { band: 'ALTO', score: 92, reasons: ['Quotidiano economico', 'Iscrizione ROC'] },
  'lastampa.it': { band: 'ALTO', score: 88, reasons: ['Testata giornalistica nazionale', 'Iscrizione ROC'] },
  'ilfattoquotidiano.it': { band: 'ALTO', score: 85, reasons: ['Testata giornalistica', 'Iscrizione ROC'] },
  'open.online': { band: 'ALTO', score: 85, reasons: ['Testata giornalistica digitale', 'Iscrizione ROC'] },
  'fanpage.it': { band: 'MEDIO', score: 75, reasons: ['Testata digitale', 'Contenuti eterogenei'] },
  
  // Agenzie di stampa
  'ansa.it': { band: 'ALTO', score: 95, reasons: ['Agenzia di stampa nazionale', 'Fonte primaria'] },
  'reuters.com': { band: 'ALTO', score: 96, reasons: ['Agenzia di stampa internazionale', 'Fonte primaria'] },
  'apnews.com': { band: 'ALTO', score: 96, reasons: ['Agenzia di stampa', 'Associated Press'] },
  
  // Broadcaster pubblici
  'bbc.com': { band: 'ALTO', score: 95, reasons: ['Broadcaster pubblico', 'BBC'] },
  'bbc.co.uk': { band: 'ALTO', score: 95, reasons: ['Broadcaster pubblico', 'BBC'] },
  
  // Testate internazionali
  'nytimes.com': { band: 'ALTO', score: 93, reasons: ['Quotidiano internazionale', 'New York Times'] },
  'theguardian.com': { band: 'ALTO', score: 90, reasons: ['Quotidiano internazionale', 'The Guardian'] },
  'washingtonpost.com': { band: 'ALTO', score: 90, reasons: ['Quotidiano internazionale', 'Washington Post'] },
  
  // Fonti istituzionali italiane
  'governo.it': { band: 'ALTO', score: 95, reasons: ['Fonte istituzionale', 'Governo italiano'] },
  'camera.it': { band: 'ALTO', score: 95, reasons: ['Fonte istituzionale', 'Camera dei Deputati'] },
  'senato.it': { band: 'ALTO', score: 95, reasons: ['Fonte istituzionale', 'Senato della Repubblica'] },
  
  // Organizzazioni internazionali
  'europa.eu': { band: 'ALTO', score: 95, reasons: ['Fonte istituzionale', 'Unione Europea'] },
  'who.int': { band: 'ALTO', score: 97, reasons: ['Organizzazione internazionale', 'OMS'] },
  'un.org': { band: 'ALTO', score: 96, reasons: ['Organizzazione internazionale', 'Nazioni Unite'] },
  
  // Riviste scientifiche peer-reviewed
  'nature.com': { band: 'ALTO', score: 98, reasons: ['Rivista peer-reviewed', 'Nature'] },
  'science.org': { band: 'ALTO', score: 98, reasons: ['Rivista peer-reviewed', 'Science'] },
  'pubmed.ncbi.nlm.nih.gov': { band: 'ALTO', score: 97, reasons: ['Database medico', 'NIH'] },
  'arxiv.org': { band: 'ALTO', score: 85, reasons: ['Repository pre-print', 'Fonte accademica'] },
  
  // Piattaforme video (neutrali)
  'youtube.com': { band: 'MEDIO', score: 60, reasons: ['Piattaforma video', 'Contenuti eterogenei'] },
  'youtu.be': { band: 'MEDIO', score: 60, reasons: ['Piattaforma video', 'YouTube'] },
  'vimeo.com': { band: 'MEDIO', score: 65, reasons: ['Piattaforma video', 'Contenuti professionali'] },
  
  // Social media (neutrali)
  'twitter.com': { band: 'MEDIO', score: 55, reasons: ['Social media', 'Contenuti eterogenei'] },
  'x.com': { band: 'MEDIO', score: 55, reasons: ['Social media', 'Contenuti eterogenei'] },
};

// ============================================================================
// URL NORMALIZATION
// ============================================================================
// Only tracking params we agreed to remove
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'igshid', 'twclid', 'ttclid'
]);

function safeNormalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    
    const cleanParams = new URLSearchParams();
    const entries = Array.from(url.searchParams.entries())
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('utm_')) return false;
        return !TRACKING_PARAMS.has(lowerKey);
      })
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [key, value] of entries) {
      cleanParams.set(key, value);
    }
    url.search = cleanParams.toString();
    
    return url.toString();
  } catch {
    // NO toLowerCase on full URL
    return rawUrl.trim();
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

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
    sourceDomain?: string;
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
      user_hash: params.userHash || null,
      source_domain: params.sourceDomain || null
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
    const { sourceUrl, postText, authorUsername, isVerified } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // HMAC secret for user hashing
    // NO fallback - if missing, userHash stays undefined
    const hmacSecret = Deno.env.get('AI_TELEMETRY_HMAC_SECRET');

    console.log('[TrustScore Edge] Request received:', {
      sourceUrl,
      postTextLength: postText?.length || 0,
      authorUsername: authorUsername || 'N/A',
      isVerified: isVerified || false
    });

    if (!sourceUrl) {
      console.log('[TrustScore Edge] Missing sourceUrl');
      return new Response(
        JSON.stringify({ error: 'sourceUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // STEP 1: Normalize URL
    const normalizedSourceUrl = safeNormalizeUrl(sourceUrl);
    const domain = extractDomain(normalizedSourceUrl);
    
    console.log('[TrustScore Edge] Normalized URL:', normalizedSourceUrl, 'Domain:', domain);

    // STEP 2: Check trusted domains whitelist (skip AI entirely)
    if (TRUSTED_DOMAINS[domain]) {
      const whitelistResult = TRUSTED_DOMAINS[domain];
      console.log('[TrustScore Edge] Whitelist HIT:', domain);
      
      // Log as cache hit (no AI call)
      await logAiUsage(supabase, {
        functionName: 'evaluate-trust-score',
        model: 'whitelist',
        inputChars: sourceUrl.length,
        outputChars: 0,
        cacheHit: true,
        latencyMs: Date.now() - startTime,
        success: true,
        sourceDomain: domain
      });
      
      return new Response(
        JSON.stringify(whitelistResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 3: Check cache
    const { data: cachedScore } = await supabase
      .from('trust_scores')
      .select('*')
      .eq('source_url', normalizedSourceUrl)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cachedScore) {
      // INVALIDATE cache if account is now verified but cached score is low
      const isVerifiedNow = isVerified === true;
      const cachedWasLow = cachedScore.band === 'BASSO';
      
      if (isVerifiedNow && cachedWasLow) {
        console.log('[TrustScore Edge] Cache invalidated: verified account with low score, recalculating');
      } else {
        console.log('[TrustScore Edge] Cache hit:', normalizedSourceUrl);
        
        await logAiUsage(supabase, {
          functionName: 'evaluate-trust-score',
          model: 'cache',
          inputChars: sourceUrl.length,
          outputChars: 0,
          cacheHit: true,
          latencyMs: Date.now() - startTime,
          success: true,
          sourceDomain: domain
        });
        
        return new Response(
          JSON.stringify({
            band: cachedScore.band,
            score: cachedScore.score,
            reasons: cachedScore.reasons
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[TrustScore Edge] Cache miss, calling AI:', normalizedSourceUrl);

    // Build author info string if available
    const authorInfo = authorUsername 
      ? `\nAUTORE: @${authorUsername}${isVerified ? ' (✓ ACCOUNT VERIFICATO)' : ''}`
      : '';

    const prompt = `Sei un esperto valutatore di fonti e contenuti web.

FONTE DA VALUTARE:
URL: ${normalizedSourceUrl}${authorInfo}
Contesto post: ${postText?.substring(0, 300) || 'N/A'}

COMPITO:
Analizza l'affidabilità della fonte considerando:
1. Dominio (es. .edu, .gov, .org, domini news riconosciuti)
2. Presenza di autori verificati o istituzioni
3. Coerenza con il contesto del post (se fornito)
4. Indizi di credibilità (es. https, certificazioni)

DOMINI RICONOSCIUTI:
- YouTube (youtube.com, youtu.be): MEDIO-ALTO (piattaforma video riconosciuta, contenuti misti)
- Vimeo (vimeo.com): MEDIO (contenuti professionali)
- Siti istituzionali (.edu, .gov, .org): ALTO
- Testate giornalistiche primarie: ALTO

ACCOUNT SOCIAL VERIFICATI:
- Su Twitter/X, un account verificato (✓) indica un'identità confermata
- Giornalisti verificati (es. @petergomezblog, @marcotravaglio): boost di credibilità +15 punti
- Account istituzionali verificati: boost +20 punti
- Account verificati generici: boost +10 punti

CLASSIFICAZIONE:
- ALTO (85-100): Fonti accademiche, governative, istituzioni riconosciute, giornali primari, account verificati di giornalisti noti
- MEDIO (50-84): Blog professionali, media regionali, siti con autori identificabili, YouTube, account social non verificati
- BASSO (0-49): Siti dubbi, no autore, clickbait, domini sospetti

OUTPUT JSON RIGOROSO:
{
  "band": "ALTO" | "MEDIO" | "BASSO",
  "score": 0-100,
  "reasons": [
    "Motivo 1 (max 50 char)",
    "Motivo 2 (max 50 char)",
    "Motivo 3 (max 50 char)"
  ]
}

REGOLE:
- Massimo 3 reasons
- Reasons brevi e specifici
- Se non puoi valutare con certezza, usa MEDIO con score 50
- Rispondi SOLO con JSON valido, senza commenti
- Per account verificati, includi "Account verificato" tra i reasons

IMPORTANTE: Sii conservativo. In caso di dubbio, preferisci MEDIO.`;

    const promptChars = prompt.length;
    const aiStartTime = Date.now();
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: 'Sei un valutatore di affidabilità delle fonti web. Rispondi sempre in JSON valido.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300
      }),
    });

    const providerLatencyMs = Date.now() - aiStartTime;

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      await logAiUsage(supabase, {
        functionName: 'evaluate-trust-score',
        model: 'google/gemini-2.5-flash-lite',
        inputChars: promptChars,
        outputChars: 0,
        cacheHit: false,
        latencyMs: Date.now() - startTime,
        providerLatencyMs,
        success: false,
        errorCode: `HTTP_${aiResponse.status}`,
        sourceDomain: domain
      });
      
      // Fallback a risposta neutra
      return new Response(
        JSON.stringify({
          band: 'MEDIO',
          score: 50,
          reasons: ['Valutazione non disponibile']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    const outputChars = content?.length || 0;
    
    // Parse JSON from AI response
    let parsedContent;
    try {
      const jsonMatch = content.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON object found in AI response');
      }
      content = jsonMatch[0];
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      
      await logAiUsage(supabase, {
        functionName: 'evaluate-trust-score',
        model: 'google/gemini-2.5-flash-lite',
        inputChars: promptChars,
        outputChars,
        cacheHit: false,
        latencyMs: Date.now() - startTime,
        providerLatencyMs,
        success: false,
        errorCode: 'PARSE_ERROR',
        sourceDomain: domain
      });
      
      return new Response(
        JSON.stringify({
          band: 'MEDIO',
          score: 50,
          reasons: ['Formato risposta AI non valido']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate schema
    if (!parsedContent.band || parsedContent.score === undefined || !Array.isArray(parsedContent.reasons)) {
      throw new Error('Invalid trust score schema');
    }

    // Ensure band is valid
    if (!['ALTO', 'MEDIO', 'BASSO'].includes(parsedContent.band)) {
      parsedContent.band = 'MEDIO';
    }

    // Ensure score is in range
    parsedContent.score = Math.max(0, Math.min(100, parsedContent.score));

    // Limit reasons to 3
    parsedContent.reasons = parsedContent.reasons.slice(0, 3);

    // Save to cache
    await supabase
      .from('trust_scores')
      .upsert({
        source_url: normalizedSourceUrl,
        band: parsedContent.band,
        score: parsedContent.score,
        reasons: parsedContent.reasons,
        calculated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: 'source_url'
      });

    // Log successful AI call
    await logAiUsage(supabase, {
      functionName: 'evaluate-trust-score',
      model: 'google/gemini-2.5-flash-lite',
      inputChars: promptChars,
      outputChars,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      providerLatencyMs,
      success: true,
      sourceDomain: domain
    });

    console.log('[TrustScore Edge] Cached and returning:', {
      band: parsedContent.band,
      score: parsedContent.score,
      reasonsCount: parsedContent.reasons.length
    });

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-trust-score:', error);
    
    // Fallback a risposta neutra invece di errore
    return new Response(
      JSON.stringify({
        band: 'MEDIO',
        score: 50,
        reasons: ['Errore durante la valutazione']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});