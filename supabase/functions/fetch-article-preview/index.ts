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
  console.log('[fetch-article-preview] ===== NEW REQUEST =====');
  console.log('[fetch-article-preview] Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('[fetch-article-preview] Handling OPTIONS (CORS preflight)');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fetch-article-preview] Parsing request body...');
    const { url } = await req.json();
    console.log('[fetch-article-preview] Received URL:', url);

    if (!url) {
      console.error('[fetch-article-preview] ERROR: URL is required but not provided');
      throw new Error('URL is required');
    }

    // Check if it's a Twitter/X URL
    const isTwitterUrl = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i);
    console.log('[fetch-article-preview] Is Twitter URL:', !!isTwitterUrl);
    
    if (isTwitterUrl) {
      console.log('[fetch-article-preview] ===== PROCESSING TWITTER URL =====');
      
      let tweetImage = null;
      let fullTweetText = '';
      let authorName = '';
      let username = '';
      
      try {
        console.log('[fetch-article-preview] Fetching tweet page directly...');
        const tweetPageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NoParrot/1.0)'
          }
        });
        
        console.log('[fetch-article-preview] Tweet page response status:', tweetPageResponse.status);
        
        if (tweetPageResponse.ok) {
          console.log('[fetch-article-preview] Parsing tweet HTML...');
          const tweetPageHtml = await tweetPageResponse.text();
          const parser = new DOMParser();
          const tweetDoc = parser.parseFromString(tweetPageHtml, 'text/html');
          
          if (!tweetDoc) {
            console.error('[fetch-article-preview] Failed to parse tweet HTML');
            throw new Error('Failed to parse tweet HTML');
          }
          
          console.log('[fetch-article-preview] Extracting metadata...');
          
          // Extract full tweet text from og:description meta tag (contains FULL text)
          const ogDescription = tweetDoc.querySelector('meta[property="og:description"]');
          fullTweetText = ogDescription?.getAttribute('content') || '';
          console.log('[fetch-article-preview] og:description extracted, length:', fullTweetText.length);
          
          // If og:description is empty, try twitter:description
          if (!fullTweetText) {
            const twitterDescription = tweetDoc.querySelector('meta[name="twitter:description"]');
            fullTweetText = twitterDescription?.getAttribute('content') || '';
            console.log('[fetch-article-preview] twitter:description extracted, length:', fullTweetText.length);
          }
          
          // Extract image from multiple possible sources
          const ogImage = tweetDoc.querySelector('meta[property="og:image"]');
          const twitterImage = tweetDoc.querySelector('meta[name="twitter:image"]');
          const twitterImageSrc = tweetDoc.querySelector('meta[name="twitter:image:src"]');
          
          const ogImageUrl = ogImage?.getAttribute('content');
          const twitterImageUrl = twitterImage?.getAttribute('content');
          const twitterImageSrcUrl = twitterImageSrc?.getAttribute('content');
          
          console.log('[fetch-article-preview] og:image:', ogImageUrl);
          console.log('[fetch-article-preview] twitter:image:', twitterImageUrl);
          console.log('[fetch-article-preview] twitter:image:src:', twitterImageSrcUrl);
          
          tweetImage = ogImageUrl || twitterImageUrl || twitterImageSrcUrl || null;
          console.log('[fetch-article-preview] Final image URL:', tweetImage);
          
          // Extract author info from URL
          const urlParts = url.split('/');
          username = urlParts[3] || 'Twitter';
          console.log('[fetch-article-preview] Extracted username from URL:', username);
          
          // Try to get author name from og:title or twitter:title
          const ogTitle = tweetDoc.querySelector('meta[property="og:title"]');
          const twitterTitle = tweetDoc.querySelector('meta[name="twitter:title"]');
          const titleText = ogTitle?.getAttribute('content') || twitterTitle?.getAttribute('content') || '';
          console.log('[fetch-article-preview] Title text:', titleText);
          
          // Title usually in format "Author Name on X: tweet text"
          const titleMatch = titleText.match(/^(.+?)\s+on\s+X:/i);
          if (titleMatch) {
            authorName = titleMatch[1].trim();
            console.log('[fetch-article-preview] Extracted author name from title:', authorName);
          } else {
            authorName = username;
            console.log('[fetch-article-preview] Using username as author name');
          }
          
          console.log('[fetch-article-preview] ===== DIRECT SCRAPING SUCCESSFUL =====');
          console.log('[fetch-article-preview] Full tweet text length:', fullTweetText.length);
          console.log('[fetch-article-preview] Tweet preview:', fullTweetText.substring(0, 100) + '...');
        } else {
          console.warn('[fetch-article-preview] Tweet page fetch failed, status:', tweetPageResponse.status);
          throw new Error(`Failed to fetch tweet page: ${tweetPageResponse.status}`);
        }
      } catch (directScrapingError) {
        console.error('[fetch-article-preview] ===== DIRECT SCRAPING FAILED =====');
        console.error('[fetch-article-preview] Error:', directScrapingError);
        console.log('[fetch-article-preview] Attempting oEmbed fallback...');
        
        // Fallback to oEmbed if direct scraping fails
        try {
          const embedHtml = await fetchTwitterEmbed(url);
          console.log('[fetch-article-preview] oEmbed response received, length:', embedHtml?.length || 0);
          
          if (embedHtml) {
            const parser = new DOMParser();
            const embedDoc = parser.parseFromString(embedHtml, 'text/html');
            
            const allParagraphs = embedDoc.querySelectorAll('blockquote.twitter-tweet p');
            console.log('[fetch-article-preview] Found paragraphs in oEmbed:', allParagraphs.length);
            
            const paragraphTexts = Array.from(allParagraphs)
              .map(p => p.textContent?.trim())
              .filter(text => text && !text.match(/^https?:\/\//));
            
            fullTweetText = paragraphTexts.join('\n\n')
              .replace(/pic\.twitter\.com\/\w+/g, '')
              .replace(/https?:\/\/t\.co\/\w+/g, '')
              .trim();
            
            console.log('[fetch-article-preview] oEmbed text extracted, length:', fullTweetText.length);
            
            const urlParts = url.split('/');
            username = urlParts[3] || 'Twitter';
            authorName = username;
            
            console.log('[fetch-article-preview] ===== OEMBED FALLBACK SUCCESSFUL =====');
          } else {
            console.error('[fetch-article-preview] oEmbed returned null');
          }
        } catch (oembedError) {
          console.error('[fetch-article-preview] ===== OEMBED FALLBACK ALSO FAILED =====');
          console.error('[fetch-article-preview] Error:', oembedError);
        }
      }
      
      // Final validation and fallback
      if (!fullTweetText || fullTweetText.length < 10) {
        console.warn('[fetch-article-preview] No tweet text extracted, using fallback');
        fullTweetText = 'Post da X/Twitter';
      }
      
      console.log('[fetch-article-preview] ===== FINAL RESULT FOR TWITTER =====');
      console.log('[fetch-article-preview] Text length:', fullTweetText.length);
      console.log('[fetch-article-preview] Image:', tweetImage ? 'YES' : 'NO');
      console.log('[fetch-article-preview] Author:', authorName);
      console.log('[fetch-article-preview] Username:', username);
      
      const result = {
        title: `Post by @${username}`,
        summary: fullTweetText,
        content: fullTweetText, // FULL untruncated text
        excerpt: fullTweetText.substring(0, 300),
        tweet_text: fullTweetText,
        author_name: authorName || username,
        author_username: username,
        previewImg: tweetImage,
        image: tweetImage,
        type: 'article',
        hostname: new URL(url).hostname,
        embedHtml: null,
        embedUrl: null,
        videoId: null,
        platform: 'twitter',
        duration: null
      };
      
      console.log('[fetch-article-preview] Returning Twitter result:', JSON.stringify(result, null, 2));
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== NON-TWITTER URL PROCESSING =====
    console.log('[fetch-article-preview] ===== PROCESSING REGULAR URL =====');

    // Normalize YouTube URLs before processing
    function normalizeYouTubeUrl(inputUrl: string): string {
      try {
        const parsed = new URL(inputUrl);
        
        // Convert youtu.be short URLs to youtube.com
        if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
          const videoId = parsed.pathname.slice(1).split('?')[0];
          console.log('[fetch-article-preview] Normalizing YouTube short URL, videoId:', videoId);
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
        
        return inputUrl;
      } catch (error) {
        console.error('[fetch-article-preview] Error normalizing YouTube URL:', error);
        return inputUrl;
      }
    }

    const normalizedUrl = normalizeYouTubeUrl(url);
    console.log('[fetch-article-preview] Normalized URL:', normalizedUrl);

    // Fetch the webpage
    console.log('[fetch-article-preview] Fetching webpage...');
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoParrot/1.0; +https://noparrot.com)'
      }
    });

    console.log('[fetch-article-preview] Response status:', response.status);

    if (!response.ok) {
      console.error('[fetch-article-preview] Failed to fetch URL, status:', response.status);
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    console.log('[fetch-article-preview] Parsing HTML...');
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      console.error('[fetch-article-preview] Failed to parse HTML');
      throw new Error('Failed to parse HTML');
    }
    
    console.log('[fetch-article-preview] HTML parsed successfully');

    // Extract metadata using Open Graph and fallbacks
    console.log('[fetch-article-preview] Extracting metadata...');
    const getMetaContent = (property: string, attribute = 'property'): string | null => {
      const meta = doc.querySelector(`meta[${attribute}="${property}"]`);
      const content = meta?.getAttribute('content') || null;
      if (content) {
        console.log(`[fetch-article-preview] Found ${attribute}="${property}":`, content.substring(0, 100));
      }
      return content;
    };

    const title = 
      getMetaContent('og:title') || 
      getMetaContent('twitter:title') ||
      doc.querySelector('title')?.textContent ||
      '';
    console.log('[fetch-article-preview] Final title:', title);

    const description = 
      getMetaContent('og:description') || 
      getMetaContent('twitter:description') ||
      getMetaContent('description', 'name') ||
      '';
    console.log('[fetch-article-preview] Final description length:', description.length);

    const image = 
      getMetaContent('og:image') || 
      getMetaContent('twitter:image') ||
      '';
    console.log('[fetch-article-preview] Final image URL:', image);

    const type = 
      getMetaContent('og:type') || 
      'article';
    console.log('[fetch-article-preview] Content type:', type);

    // Extract content from main content area
    console.log('[fetch-article-preview] Extracting main content...');
    const mainContent = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('body');
    const paragraphs = Array.from(mainContent?.querySelectorAll('p') || []);
    console.log('[fetch-article-preview] Found paragraphs:', paragraphs.length);
    
    // Extract excerpt (first meaningful paragraph, max 300 chars)
    const excerpt = paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 50)
      [0]?.substring(0, 300) || '';
    console.log('[fetch-article-preview] Excerpt length:', excerpt.length);

    // Extract full content (all meaningful paragraphs, max 5000 chars for better quiz coverage)
    const fullContent = paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 30)
      .join('\n\n')
      .substring(0, 5000);
    console.log('[fetch-article-preview] Full content length:', fullContent.length);

    const hostname = new URL(normalizedUrl).hostname.replace('www.', '');
    console.log('[fetch-article-preview] Hostname:', hostname);

    // Detect video platforms
    console.log('[fetch-article-preview] Checking for video platforms...');
    const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');
    const isVimeo = normalizedUrl.includes('vimeo.com');
    console.log('[fetch-article-preview] YouTube:', isYouTube, 'Vimeo:', isVimeo);
    
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
        console.log('[fetch-article-preview] YouTube video detected, ID:', videoId);
      }
    } else if (isVimeo) {
      const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
      const match = normalizedUrl.match(vimeoRegex);
      if (match) {
        videoId = match[1];
        embedUrl = `https://player.vimeo.com/video/${videoId}`;
        platform = 'vimeo';
        console.log('[fetch-article-preview] Vimeo video detected, ID:', videoId);
      }
    }
    
    const videoDuration = getMetaContent('video:duration');
    const isVideoContent = isYouTube || isVimeo || type === 'video';
    console.log('[fetch-article-preview] Is video content:', isVideoContent);

    console.log('[fetch-article-preview] ===== FINAL RESULT FOR REGULAR URL =====');
    console.log('[fetch-article-preview] Title:', title.substring(0, 50));
    console.log('[fetch-article-preview] Content length:', fullContent.length, 'chars');
    console.log('[fetch-article-preview] Image:', image ? 'YES' : 'NO');
    console.log('[fetch-article-preview] Type:', isVideoContent ? 'video' : 'article');
    if (isVideoContent) {
      console.log('[fetch-article-preview] Platform:', platform, 'Video ID:', videoId);
    }

    const result = {
      title: title.substring(0, 200),
      summary: description.substring(0, 500),
      excerpt: excerpt,
      content: fullContent || description,
      previewImg: image,
      image: image, // Add image field for consistency
      type: isVideoContent ? 'video' : 'article',
      hostname,
      embedUrl,
      videoId,
      platform,
      duration: videoDuration
    };

    console.log('[fetch-article-preview] Returning result:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-article-preview] ===== FATAL ERROR =====');
    console.error('[fetch-article-preview] Error type:', error.constructor.name);
    console.error('[fetch-article-preview] Error message:', error.message);
    console.error('[fetch-article-preview] Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
