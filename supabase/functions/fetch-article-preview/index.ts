import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoParrot/1.0; +https://noparrot.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Extract metadata using Open Graph and fallbacks
    const getMetaContent = (property: string, attribute = 'property'): string | null => {
      const meta = doc.querySelector(`meta[${attribute}="${property}"]`);
      return meta?.getAttribute('content') || null;
    };

    const title = 
      getMetaContent('og:title') || 
      getMetaContent('twitter:title') ||
      doc.querySelector('title')?.textContent ||
      '';

    const description = 
      getMetaContent('og:description') || 
      getMetaContent('twitter:description') ||
      getMetaContent('description', 'name') ||
      '';

    const image = 
      getMetaContent('og:image') || 
      getMetaContent('twitter:image') ||
      '';

    const type = 
      getMetaContent('og:type') || 
      'article';

    // Extract content from main content area
    const mainContent = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('body');
    const paragraphs = Array.from(mainContent?.querySelectorAll('p') || []);
    
    // Extract excerpt (first meaningful paragraph, max 300 chars)
    const excerpt = paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 50)
      [0]?.substring(0, 300) || '';

    // Extract full content (all meaningful paragraphs, max 3000 chars)
    const fullContent = paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 30)
      .join('\n\n')
      .substring(0, 3000);

    const hostname = new URL(url).hostname.replace('www.', '');

    console.log(`Preview extracted for: ${hostname}`);
    console.log(`Full content length: ${fullContent.length} chars`);

    return new Response(
      JSON.stringify({
        title: title.substring(0, 200),
        summary: description.substring(0, 500),
        excerpt: excerpt,
        content: fullContent,
        previewImg: image,
        type: type === 'video' ? 'video' : 'article',
        hostname
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-article-preview:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
