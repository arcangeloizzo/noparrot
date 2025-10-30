// supabase/functions/evaluate-trust-score/index.ts

import { serve } from "[https://deno.land/std@0.168.0/http/server.ts](https://deno.land/std@0.168.0/http/server.ts)";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceUrl, postText } = await req.json();

    if (!sourceUrl) {
      throw new Error('sourceUrl is required');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Normalize YouTube URLs before evaluation
    function normalizeYouTubeUrl(inputUrl: string): string {
      try {
        const parsed = new URL(inputUrl);
        if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
          const videoId = parsed.pathname.slice(1).split('?')[0];
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return inputUrl;
      } catch {
        return inputUrl;
      }
    }

    const normalizedSourceUrl = normalizeYouTubeUrl(sourceUrl);

    const prompt = `Sei un esperto valutatore di fonti e contenuti web.

FONTE DA VALUTARE:
URL: ${normalizedSourceUrl}
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

CLASSIFICAZIONE:
- ALTO (85-100): Fonti accademiche, governative, istituzioni riconosciute, giornali primari
- MEDIO (50-84): Blog professionali, media regionali, siti con autori identificabili, YouTube
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

IMPORTANTE: Sii conservativo. In caso di dubbio, preferisci MEDIO.`;

    const aiResponse = await fetch('[https://ai.gateway.lovable.dev/v1/chat/completions](https://ai.gateway.lovable.dev/v1/chat/completions)', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-1.5-flash', // <-- MODIFICA 1: Corretto il nome del modello
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
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
    
    // Parse JSON from AI response
    let parsedContent;
    try {
      // --- MODIFICA 2: Logica di parsing più robusta ---
      const jsonMatch = content.match(/{[\s\S]*}/); // Cerca il primo { e l'ultimo }
      if (!jsonMatch) {
        throw new Error('No valid JSON object found in AI response');
      }
      content = jsonMatch[0];
      // --- Fine Modifica 2 ---
      
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      
      // Fallback
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

    console.log('Trust score evaluated:', parsedContent);

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