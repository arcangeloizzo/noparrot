import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch Twitter/X oEmbed
async function fetchTwitterEmbed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data.html || null;
  } catch (error) {
    console.error('Error fetching Twitter oEmbed:', error);
    return null;
  }
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

    // Check if it's a Twitter/X URL
    const isTwitterUrl = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i);
    if (isTwitterUrl) {
      console.log('Detected Twitter/X URL, fetching oEmbed...');
      const embedHtml = await fetchTwitterEmbed(url);
      
      if (embedHtml) {
        // Extract info from embed HTML
        const parser = new DOMParser();
        const embedDoc = parser.parseFromString(embedHtml, 'text/html');
        
        // Extract author info from blockquote
        const blockquote = embedDoc.querySelector('blockquote.twitter-tweet');
        const authorLink = blockquote?.querySelector('a[href*="/status/"]');
        const authorName = authorLink?.textContent?.trim() || '';
        
        // Extract username from URL
        const urlParts = url.split('/');
        const username = urlParts[3] || 'Twitter';
        
        // Extract tweet text
        let tweetText = '';
        const mainParagraph = embedDoc.querySelector('blockquote.twitter-tweet p[lang]');
        if (mainParagraph) {
          tweetText = mainParagraph.textContent?.trim() || '';
        }
        
        if (!tweetText) {
          const anyParagraph = embedDoc.querySelector('blockquote.twitter-tweet p');
          tweetText = anyParagraph?.textContent?.trim() || '';
        }
        
        if (!tweetText) {
          const allParagraphs = embedDoc.querySelectorAll('blockquote.twitter-tweet p');
          tweetText = Array.from(allParagraphs)
            .map(p => p.textContent?.trim())
            .filter(Boolean)
            .join('\n');
        }
        
        // Clean up text
        tweetText = tweetText
          .replace(/pic\.twitter\.com\/\w+/g, '')
          .replace(/https?:\/\/t\.co\/\w+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (!tweetText || tweetText.length < 10) {
          tweetText = 'Post da X/Twitter';
        }
        
        // Try to extract image from embed HTML (usually in <a> tags with pic.twitter.com)
        let tweetImage = null;
        const imgLinks = Array.from(embedDoc.querySelectorAll('a[href*="pic.twitter.com"]'));
        if (imgLinks.length > 0) {
          // Twitter images are often linked, we'll need to construct a proper image URL
          // For now, we'll mark that an image exists
          tweetImage = null; // We can't reliably extract the actual image URL from oEmbed
        }
        
        console.log('[fetch-article-preview] Tweet URL:', url);
        console.log('[fetch-article-preview] Author:', authorName);
        console.log('[fetch-article-preview] Username:', username);
        console.log('[fetch-article-preview] Tweet text:', tweetText);
        console.log('[fetch-article-preview] Tweet text length:', tweetText.length);
        
        return new Response(JSON.stringify({
          title: `Post by @${username}`,
          summary: tweetText,
          content: tweetText,
          excerpt: tweetText,
          tweet_text: tweetText,
          author_name: authorName || username,
          author_username: username,
          previewImg: tweetImage,
          type: 'article',
          hostname: new URL(url).hostname,
          embedHtml,
          embedUrl: null,
          videoId: null,
          platform: 'twitter',
          duration: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Normalize YouTube URLs before processing
    function normalizeYouTubeUrl(inputUrl: string): string {
      try {
        const parsed = new URL(inputUrl);
        
        // Convert youtu.be short URLs to youtube.com
        if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
          const videoId = parsed.pathname.slice(1).split('?')[0];
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
        
        return inputUrl;
      } catch {
        return inputUrl;
      }
    }

    const normalizedUrl = normalizeYouTubeUrl(url);

    // Fetch the webpage
    const response = await fetch(normalizedUrl, {
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

    const hostname = new URL(normalizedUrl).hostname.replace('www.', '');

    // Detect video platforms
    const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    const isVimeo = normalizedUrl.includes('vimeo.com');
    
    let embedUrl = null;
    let videoId = null;
    let platform = null;
    
    if (isYouTube) {
      // Extract YouTube video ID from various URL formats
      const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = normalizedUrl.match(youtubeRegex);
      if (match) {
        videoId = match[1];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
        platform = 'youtube';
      }
    } else if (isVimeo) {
      const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
      const match = normalizedUrl.match(vimeoRegex);
      if (match) {
        videoId = match[1];
        embedUrl = `https://player.vimeo.com/video/${videoId}`;
        platform = 'vimeo';
      }
    }
    
    const videoDuration = getMetaContent('video:duration');
    const isVideoContent = isYouTube || isVimeo || type === 'video';

    console.log(`Preview extracted for: ${hostname}`);
    console.log(`Full content length: ${fullContent.length} chars`);
    if (isVideoContent) {
      console.log(`Video detected: platform=${platform}, videoId=${videoId}`);
    }

    return new Response(
      JSON.stringify({
        title: title.substring(0, 200),
        summary: description.substring(0, 500),
        excerpt: excerpt,
        content: fullContent || description,
        previewImg: image,
        type: isVideoContent ? 'video' : 'article',
        hostname,
        embedUrl,
        videoId,
        platform,
        duration: videoDuration
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
