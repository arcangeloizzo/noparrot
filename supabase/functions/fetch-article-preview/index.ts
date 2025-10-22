import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[FETCH] ========== NEW REQUEST ==========');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log('[FETCH] URL:', url);

    if (!url) {
      throw new Error('URL is required');
    }

    // Check if Twitter/X URL
    const isTwitter = url.includes('twitter.com') || url.includes('x.com');
    console.log('[FETCH] Is Twitter:', isTwitter);

    if (isTwitter) {
      // IMPORTANT: X.com URLs need to be converted to twitter.com for oEmbed
      const twitterUrl = url.replace('x.com', 'twitter.com');
      console.log('[FETCH] Converted URL:', twitterUrl);
      
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`;
      console.log('[FETCH] oEmbed URL:', oembedUrl);
      
      const response = await fetch(oembedUrl);
      console.log('[FETCH] oEmbed status:', response.status);
      
      if (!response.ok) {
        throw new Error(`oEmbed failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[FETCH] oEmbed data keys:', Object.keys(data));
      
      const result = {
        title: data.author_name ? `Post by @${data.author_name}` : 'Post da X/Twitter',
        author_username: data.author_name || '',
        author_name: data.author_name || '',
        summary: data.html || '',
        content: data.html || '', // Full embed HTML with tweet content
        image: '',
        previewImg: '',
        platform: 'twitter',
        type: 'tweet',
        embedHtml: data.html,
        hostname: 'x.com'
      };

      console.log('[FETCH] Returning Twitter result');
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generic URL
    console.log('[FETCH] Processing as generic URL');
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
    console.error('[FETCH] ERROR:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});