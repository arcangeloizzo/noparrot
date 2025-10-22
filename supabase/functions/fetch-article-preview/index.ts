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
      
      const result = {
        title: data.author_name ? `Post by @${data.author_name}` : 'Post da X/Twitter',
        author_username: data.author_name || '',
        author_name: data.author_name || '',
        summary: plainText, // Plain text for display
        content: plainText, // Plain text for quiz
        image: '',
        previewImg: '',
        platform: 'twitter',
        type: 'tweet',
        embedHtml: data.html, // HTML only for embed rendering
        hostname: 'x.com'
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generic URL
    const result = {
      title: 'Article',
      summary: '',
      content: '',
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