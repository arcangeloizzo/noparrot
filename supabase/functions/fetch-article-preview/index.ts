import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract plain text from HTML
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;/g, '"')  // left double quote
    .replace(/&#8221;/g, '"')  // right double quote
    .replace(/&#8222;/g, '"')  // double low-9 quote
    .replace(/&#8217;/g, "'")  // right single quote
    .replace(/&#8216;/g, "'")  // left single quote
    .replace(/&#8211;/g, '–')  // en dash
    .replace(/&#8212;/g, '—')  // em dash
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
  
  // Decode all remaining numeric HTML entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Detect social media platforms
function detectSocialPlatform(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('threads.net')) return 'threads';
  return null;
}

// Fetch social content using Jina AI Reader (FREE)
async function fetchSocialWithJina(url: string, platform: string) {
  try {
    console.log(`[fetch-article-preview] Fetching ${platform} content via Jina AI Reader`);
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      }
    });
    
    if (!response.ok) {
      console.error(`[fetch-article-preview] Jina AI fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('[fetch-article-preview] Jina AI extraction successful:', {
      title: data.title,
      contentLength: data.content?.length || 0,
      hasImage: !!data.image
    });
    
    // Extract author from LinkedIn/Instagram
    let author = data.author_name || data.author || '';
    if (platform === 'linkedin' && data.content) {
      const authorMatch = data.content.match(/(?:Posted by|By)\s+([^\n]+)/i);
      if (authorMatch) author = authorMatch[1].trim();
    }
    
    return {
      title: data.title || `Post from ${platform}`,
      content: data.content || '',
      summary: data.description || (data.content ? data.content.substring(0, 300) + '...' : ''),
      image: data.image || '',
      previewImg: data.image || '',
      platform,
      type: 'social',
      author,
      author_username: platform === 'twitter' ? author.replace('@', '') : '',
      hostname: new URL(url).hostname
    };
  } catch (error) {
    console.error('[fetch-article-preview] Jina AI error:', error);
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

    // Check if it's a YouTube link
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      console.log('[fetch-article-preview] Detected YouTube video:', youtubeId);
      
      try {
        // Fetch YouTube metadata using oEmbed
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl);
        
        if (!oembedResponse.ok) {
          throw new Error('Failed to fetch YouTube oEmbed data');
        }
        
        const oembedData = await oembedResponse.json();
        
        // Get transcript using our transcribe-youtube function
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        let transcript = null;
        let transcriptSource = 'none';
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const transcriptResponse = await fetch(
              `${SUPABASE_URL}/functions/v1/transcribe-youtube`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ url }),
              }
            );
            
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json();
              transcript = transcriptData.transcript;
              transcriptSource = transcriptData.source || 'none';
              console.log(`[fetch-article-preview] Transcript ${transcriptSource === 'youtube_captions' ? 'fetched' : 'not available'} for video ${youtubeId}`);
            }
          } catch (transcriptError) {
            console.error('[fetch-article-preview] Error fetching transcript:', transcriptError);
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          title: oembedData.title,
          content: transcript || `Video: ${oembedData.title}`,
          summary: transcript ? transcript.substring(0, 500) + '...' : oembedData.title,
          image: oembedData.thumbnail_url,
          platform: 'youtube',
          type: 'video',
          embedHtml: oembedData.html,
          transcript: transcript,
          transcriptSource: transcriptSource,
          author: oembedData.author_name,
          authorUrl: oembedData.author_url,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[fetch-article-preview] Error fetching YouTube data:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if it's a social media link (Twitter/X, LinkedIn, Instagram, Threads)
    const socialPlatform = detectSocialPlatform(url);
    if (socialPlatform) {
      console.log(`[fetch-article-preview] Detected ${socialPlatform} link`);
      
      // Try Jina AI Reader first (FREE)
      const jinaResult = await fetchSocialWithJina(url, socialPlatform);
      if (jinaResult) {
        return new Response(JSON.stringify({ success: true, ...jinaResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Fallback to oEmbed for Twitter only
      if (socialPlatform === 'twitter') {
        try {
          const twitterUrl = url.replace('x.com', 'twitter.com');
          const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`;
          
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
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
              type: 'social',
              embedHtml: data.html,
              hostname: 'x.com'
            };

            return new Response(JSON.stringify({ success: true, ...result }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (twitterError) {
          console.error('[fetch-article-preview] Twitter oEmbed fallback failed:', twitterError);
        }
      }
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
        
        // Extract all significant paragraphs for content
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>(.+?)<\/p>/gis;
        let match;
        while ((match = pRegex.exec(html)) !== null && paragraphs.length < 7) {
          const text = extractTextFromHtml(match[0]);
          if (text.length > 50) {
            paragraphs.push(text);
          }
        }
        const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : description;
        
        console.log('[fetch-article-preview] Extracted data:', { title, hasDescription: !!description, hasImage: !!image });
        
        // If we got minimal data or short content, try AI extraction
        if (!title || title === 'Article' || (!description && !content) || content.length < 200) {
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
                    content: 'Extract article metadata from HTML. Return ONLY valid JSON with fields: title, description, content (extract the FULL article body text with all main paragraphs, at least 500 characters if available). No markdown, no extra text.' 
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
                  // Remove markdown code fences if present
                  let cleanContent = aiContent.trim();
                  if (cleanContent.startsWith('```json')) {
                    cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                  } else if (cleanContent.startsWith('```')) {
                    cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
                  }
                  
                  const extracted = JSON.parse(cleanContent);
                  
                  const result = {
                    success: true,
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
          success: true,
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
      success: true,
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