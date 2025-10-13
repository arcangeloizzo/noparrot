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
    const { contentId, isPrePublish, title, summary, excerpt, type, sourceUrl } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if Q&A already exists
    let query = supabase
      .from('post_qa')
      .select('*')
      .eq('source_url', sourceUrl || '');
    
    if (isPrePublish) {
      query = query.is('post_id', null);
    } else {
      query = query.eq('post_id', contentId);
    }
    
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      console.log('Q&A già esistente, ritorno cached version');
      return new Response(
        JSON.stringify({ questions: existing.questions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Q&A with Lovable AI
    const contentText = `${title || ''}\n\n${summary || ''}\n\n${excerpt || ''}`.trim();
    
    if (contentText.length < 50) {
      return new Response(
        JSON.stringify({ insufficient_context: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Sei un assistente esperto nella valutazione della comprensione.

CONTENUTO DA ANALIZZARE:
${contentText.substring(0, 1200)}

REGOLE GENERAZIONE:
1. Genera ESATTAMENTE 3 domande:
   - Domanda 1 (MACRO): Sul tema principale o idea centrale
   - Domanda 2 (MACRO): Su evidenza, impatto o conseguenza descritta
   - Domanda 3 (DETTAGLIO): Su un dato specifico, cifra, nome o metodologia
   
2. Per ogni domanda:
   - 3 opzioni di risposta (A, B, C)
   - Solo 1 opzione corretta
   - Le altre 2 plausibili ma sbagliate
   - Difficoltà media (no trabocchetti)
   - IMPORTANTE: Varia la posizione della risposta corretta tra A, B, C in modo casuale
   
3. OUTPUT JSON rigoroso:
{
  "questions": [
    {
      "id": "q1",
      "stem": "Domanda 1 qui",
      "choices": [
        {"id": "a", "text": "Opzione corretta"},
        {"id": "b", "text": "Opzione plausibile errata"},
        {"id": "c", "text": "Opzione plausibile errata"}
      ],
      "correctId": "a"
    }
  ]
}

4. Se il contenuto è insufficiente per generare domande valide, restituisci:
{"insufficient_context": true}

IMPORTANTE: Rispondi SOLO con JSON valido, senza commenti o testo aggiuntivo.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Sei un assistente per quiz di comprensione. Rispondi sempre in JSON valido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 900
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse JSON from AI response
    let parsedContent;
    try {
      // Strip markdown code fences if present
      let cleanContent = content.trim();
      
      // Remove ```json at the start
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      
      // Remove ``` at the end
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      
      cleanContent = cleanContent.trim();
      
      parsedContent = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    if (parsedContent.insufficient_context) {
      return new Response(
        JSON.stringify({ insufficient_context: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate schema
    if (!parsedContent.questions || parsedContent.questions.length !== 3) {
      throw new Error('Invalid Q&A schema');
    }

    // Shuffle choices for each question to randomize answer positions
    function shuffleArray<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    const shuffledQuestions = parsedContent.questions.map((q: any) => ({
      ...q,
      choices: shuffleArray(q.choices)
    }));

    // Extract correct answers
    const correctAnswers = shuffledQuestions.map((q: any) => ({
      id: q.id,
      correctId: q.correctId
    }));

    // Save to database
    await supabase.from('post_qa').insert({
      post_id: isPrePublish ? null : contentId,
      source_url: sourceUrl || '',
      questions: shuffledQuestions,
      correct_answers: correctAnswers,
      generated_from: 'gemini'
    });

    console.log('Q&A generated and saved successfully');

    return new Response(
      JSON.stringify({ questions: shuffledQuestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-qa:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
