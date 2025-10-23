import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract plain text from HTML
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    const isTwitter = url.includes('twitter.com') || url.includes('x.com');

    if (isTwitter) {
      const twitterUrl = url.replace('x.com', 'twitter.com');
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`;
      
      const response = await fetch(oembedUrl);
      
      if (!response.ok) {
        throw new Error(`oEmbed failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract plain text from HTML for content field
      const plainText = extractTextFromHtml(data.html || '');
      
      // Extract image URL from oEmbed data or HTML
      let imageUrl = '';
      if (data.thumbnail_url) {
        imageUrl = data.thumbnail_url;
      } else if (data.html) {
        // Try to extract image from HTML
        const imgMatch = data.html.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }
      
      const result = {
        title: data.author_name ? `Post by @${data.author_name}` : 'Post da X/Twitter',
        author_username: data.author_name || '',
        author_name: data.author_name || '',
        summary: plainText,
        content: plainText,
        image: imageUrl,
        previewImg: imageUrl,
        platform: 'twitter',
        type: 'tweet',
        embedHtml: data.html,
        hostname: 'x.com'
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generic URL - try basic fetch
    try {
      console.log('[fetch-article-preview] Fetching URL:', url);
      
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
        }
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        console.log('[fetch-article-preview] HTML fetched, length:', html.length);
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract meta description
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract og:image
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        const image = imgMatch ? imgMatch[1] : '';
        
        // Extract first paragraph for content
        const bodyMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
        const content = bodyMatch ? extractTextFromHtml(bodyMatch[0]) : description;
        
        console.log('[fetch-article-preview] Extracted data:', { title, hasDescription: !!description, hasImage: !!image });
        
        // If we got minimal data, try AI extraction
        if (!title || title === 'Article' || (!description && !content)) {
          console.log('[fetch-article-preview] Poor extraction, trying AI fallback');
          
          try {
            const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
            if (!LOVABLE_API_KEY) {
              console.error('[fetch-article-preview] LOVABLE_API_KEY not configured');
              throw new Error('AI extraction unavailable');
            }

            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { 
                    role: 'system', 
                    content: 'Extract article metadata from HTML. Return ONLY valid JSON with fields: title, description, content (first 2-3 paragraphs). No markdown, no extra text.' 
                  },
                  { 
                    role: 'user', 
                    content: `Extract metadata from this HTML:\n\n${html.substring(0, 15000)}` 
                  }
                ],
                temperature: 0.3
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const aiContent = aiData.choices?.[0]?.message?.content;
              
              if (aiContent) {
                console.log('[fetch-article-preview] AI response:', aiContent);
                
                try {
                  const extracted = JSON.parse(aiContent);
                  
                  const result = {
                    title: extracted.title || title || 'Article',
                    summary: extracted.description || description,
                    content: extracted.content || content || extracted.description || description,
                    image,
                    previewImg: image,
                    platform: 'generic',
                    type: 'article',
                    hostname: new URL(url).hostname
                  };
                  
                  console.log('[fetch-article-preview] AI extraction successful');
                  return new Response(JSON.stringify(result), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  });
                } catch (parseError) {
                  console.error('[fetch-article-preview] Failed to parse AI JSON:', parseError);
                }
              }
            }
          } catch (aiError) {
            console.error('[fetch-article-preview] AI extraction failed:', aiError);
          }
        }
        
        // Return what we extracted (even if minimal)
        const result = {
          title: title || 'Article',
          summary: description,
          content: content || description,
          image,
          previewImg: image,
          platform: 'generic',
          type: 'article',
          hostname: new URL(url).hostname
        };
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (fetchError) {
      console.error('[fetch-article-preview] Generic URL fetch failed:', fetchError);
    }
    
    // Fallback
    const result = {
      title: 'Article',
      summary: '',
      content: 'Apri il link per leggere il contenuto completo.',
      platform: 'generic',
      type: 'article',
      hostname: new URL(url).hostname
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});