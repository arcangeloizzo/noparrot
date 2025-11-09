import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract plain text from HTML - Enhanced version
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
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
    .replace(/&#8230;/g, '…')  // ellipsis
    .replace(/&#8203;/g, '')   // zero-width space
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
  
  // Decode all remaining numeric HTML entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  // Decode hex HTML entities
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
    .trim();
}

// Aggressive HTML cleaning for reader (removes ALL HTML, converts lists)
function cleanReaderText(html: string): string {
  let text = html
    // Remove scripts, styles, comments completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert list items to bullet points
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // Convert headings to uppercase with newlines
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
    // Convert paragraphs to double newlines
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // Convert breaks to newlines
    .replace(/<br[^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode ALL HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8222;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&#8203;/g, '')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width chars
  
  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Clean up whitespace while preserving paragraph structure
  return text
    .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
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
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) return 'facebook';
  return null;
}

// Fetch social content using Jina AI Reader (FREE) - Enhanced for all platforms
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
      hasImage: !!data.image,
      platform
    });
    
    // Extract author - platform-specific logic
    let author = data.author_name || data.author || '';
    let authorUsername = '';
    
    if (platform === 'linkedin' && data.content) {
      const authorMatch = data.content.match(/(?:Posted by|By)\s+([^\n]+)/i);
      if (authorMatch) author = authorMatch[1].trim();
    } else if (platform === 'twitter' && data.content) {
      // Extract username from Twitter/X content
      const usernameMatch = data.content.match(/@(\w+)/);
      if (usernameMatch) authorUsername = usernameMatch[1];
    } else if (platform === 'facebook' && data.content) {
      // Extract author from Facebook content
      const fbAuthorMatch = data.content.match(/^([^\n]+)/);
      if (fbAuthorMatch) author = fbAuthorMatch[1].trim();
    }
    
    // Clean content with new function
    const cleanedContent = cleanReaderText(data.content || '');
    
    return {
      title: data.title || `Post da ${platform}`,
      content: cleanedContent,
      summary: data.description || (cleanedContent ? cleanedContent.substring(0, 300) + '...' : ''),
      image: data.image || '',
      previewImg: data.image || '',
      platform,
      type: 'social',
      author,
      author_username: authorUsername || (platform === 'twitter' ? author.replace('@', '') : ''),
      hostname: new URL(url).hostname,
      contentQuality: cleanedContent.length > 200 ? 'complete' : 'partial'
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
        let transcriptAvailable = false;
        let transcriptError = null;
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          try {
            console.log(`[fetch-article-preview] Attempting to fetch transcript for video ${youtubeId}`);
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
              
              if (transcriptData.transcript && transcriptData.transcript.length > 50) {
                transcript = transcriptData.transcript;
                transcriptSource = transcriptData.source || 'youtube_captions';
                transcriptAvailable = true;
                console.log(`[fetch-article-preview] ✅ Transcript fetched successfully (${transcriptSource}), length: ${transcript.length}`);
              } else if (transcriptData.error) {
                transcriptError = transcriptData.error;
                console.warn(`[fetch-article-preview] ⚠️ Transcript error: ${transcriptData.error}`);
              } else {
                console.warn(`[fetch-article-preview] ⚠️ Transcript too short or empty for video ${youtubeId}`);
              }
            } else {
              const errorText = await transcriptResponse.text();
              transcriptError = `HTTP ${transcriptResponse.status}: ${errorText}`;
              console.error(`[fetch-article-preview] ❌ Transcript fetch failed: ${transcriptError}`);
            }
          } catch (transcriptFetchError) {
            transcriptError = transcriptFetchError instanceof Error ? transcriptFetchError.message : 'Unknown error';
            console.error('[fetch-article-preview] ❌ Exception fetching transcript:', transcriptFetchError);
          }
        } else {
          console.warn('[fetch-article-preview] ⚠️ Missing SUPABASE_URL or SERVICE_ROLE_KEY for transcript fetch');
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
          transcriptAvailable,
          transcriptError,
          author: oembedData.author_name,
          authorUrl: oembedData.author_url,
          contentQuality: transcript && transcript.length > 500 ? 'complete' : 'partial'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[fetch-article-preview] Error fetching YouTube data:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if it's a social media link (Twitter/X, LinkedIn, Instagram, Threads, Facebook)
    const socialPlatform = detectSocialPlatform(url);
    if (socialPlatform) {
      console.log(`[fetch-article-preview] Detected ${socialPlatform} link`);
      
      // ALWAYS try Jina AI Reader first for ALL social platforms (richer metadata)
      const jinaResult = await fetchSocialWithJina(url, socialPlatform);
      if (jinaResult && jinaResult.content && jinaResult.content.length > 50) {
        console.log(`[fetch-article-preview] ✅ Jina AI successful for ${socialPlatform}`);
        return new Response(JSON.stringify({ success: true, ...jinaResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[fetch-article-preview] ⚠️ Jina AI failed or returned poor content for ${socialPlatform}, trying fallback`);
      
      // Fallback to oEmbed ONLY for Twitter (last resort)
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
        
        // If we got minimal data or short content, try AI extraction with Lovable AI
        if (!title || title === 'Article' || (!description && !content) || content.length < 200) {
          console.log('[fetch-article-preview] Poor extraction, trying Lovable AI fallback');
          
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
                    content: 'You are an expert at extracting clean article content from HTML. Extract the main article text, removing ALL HTML tags, ads, navigation, and formatting. Return ONLY valid JSON with: title (string), description (string, max 300 chars), content (string, the FULL clean article text with all paragraphs, minimum 500 characters if available). Remove all HTML entities and invisible characters. Format content with simple paragraph breaks (\\n\\n).' 
                  },
                  { 
                    role: 'user', 
                    content: `Extract clean text from this HTML page:\n\n${html.substring(0, 20000)}` 
                  }
                ],
                temperature: 0.2,
                max_tokens: 2000
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
                  
                  // Clean the AI-extracted content too
                  const cleanedAiContent = cleanReaderText(extracted.content || '');
                  
                  const result = {
                    success: true,
                    title: extracted.title || title || 'Article',
                    summary: extracted.description || description,
                    content: cleanedAiContent || content || extracted.description || description,
                    image,
                    previewImg: image,
                    platform: 'generic',
                    type: 'article',
                    hostname: new URL(url).hostname,
                    contentQuality: cleanedAiContent.length > 500 ? 'complete' : 'partial'
                  };
                  
                  console.log('[fetch-article-preview] ✅ AI extraction successful, content length:', cleanedAiContent.length);
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
        
        // Return what we extracted (even if minimal) - with cleaned content
        const cleanedContent = cleanReaderText(content || description);
        const result = {
          success: true,
          title: title || 'Article',
          summary: description,
          content: cleanedContent,
          image,
          previewImg: image,
          platform: 'generic',
          type: 'article',
          hostname: new URL(url).hostname,
          contentQuality: cleanedContent.length > 300 ? 'complete' : 'partial'
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
    console.error('[fetch-article-preview] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred fetching article preview',
        code: 'INTERNAL_ERROR'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});