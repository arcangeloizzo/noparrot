import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const prompt = `Sei un esperto valutatore di fonti e contenuti web. 

FONTE DA VALUTARE:
URL: ${sourceUrl}
Contesto post: ${postText?.substring(0, 300) || 'N/A'}

COMPITO:
Analizza l'affidabilità della fonte considerando:
1. Dominio (es. .edu, .gov, .org, domini news riconosciuti)
2. Presenza di autori verificati o istituzioni
3. Coerenza con il contesto del post (se fornito)
4. Indizi di credibilità (es. https, certificazioni)

CLASSIFICAZIONE:
- ALTO (85-100): Fonti accademiche, governative, istituzioni riconosciute, giornali primari
- MEDIO (50-84): Blog professionali, media regionali, siti con autori identificabili
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

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
      // Strip markdown code fences
      content = content.trim();
      if (content.startsWith('```json')) content = content.slice(7);
      if (content.startsWith('```')) content = content.slice(3);
      if (content.endsWith('```')) content = content.slice(0, -3);
      content = content.trim();
      
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
