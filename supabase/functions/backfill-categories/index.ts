import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  'Società & Politica',
  'Economia & Business',
  'Scienza & Tecnologia',
  'Cultura & Arte',
  'Pianeta & Ambiente',
  'Sport & Lifestyle',
  'Salute & Benessere',
  'Media & Comunicazione'
];

async function classifyContent(text: string, title?: string, summary?: string): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return null;
    }

    const contentToClassify = [text, title, summary].filter(Boolean).join('\n\n');
    
    const systemPrompt = `You are a content classifier. Classify the following content into ONE of these categories:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond with ONLY the category name, nothing else.`;

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
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim();
    
    return CATEGORIES.includes(category) ? category : null;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting backfill process...');

    // Fetch all posts without a category
    const { data: posts, error: fetchError } = await supabaseClient
      .from('posts')
      .select('id, content, shared_title, article_content')
      .is('category', null);

    if (fetchError) {
      console.error('Error fetching posts:', fetchError);
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      console.log('No posts to classify');
      return new Response(
        JSON.stringify({ 
          message: 'No posts to classify',
          processed: 0,
          success: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${posts.length} posts to classify`);

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ postId: string; error: string }> = [];

    // Process posts with rate limiting
    for (const post of posts) {
      try {
        console.log(`Processing post ${post.id}...`);

        // Classify content directly
        const category = await classifyContent(
          post.content,
          post.shared_title || undefined,
          post.article_content || undefined
        );

        if (!category) {
          console.warn(`No category returned for post ${post.id}`);
          failedCount++;
          errors.push({ postId: post.id, error: 'No category returned' });
          continue;
        }

        // Update post with category
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { error: updateError } = await supabaseClient
          .from('posts')
          .update({ category })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Update error for post ${post.id}:`, updateError);
          failedCount++;
          errors.push({ postId: post.id, error: updateError.message });
          continue;
        }

        console.log(`Successfully classified post ${post.id} as: ${category}`);
        successCount++;

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Unexpected error processing post ${post.id}:`, error);
        failedCount++;
        errors.push({ 
          postId: post.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const result = {
      message: 'Backfill completed',
      processed: posts.length,
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('Backfill result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
