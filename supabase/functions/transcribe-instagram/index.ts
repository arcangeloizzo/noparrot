import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { classifyLinkPreviewImage } from '../_shared/media.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isInstagramReelUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const isInstagram = parsed.hostname === 'www.instagram.com' 
      || parsed.hostname === 'instagram.com';
    const isReelOrPost = /^\/(reel|reels|p)\/[\w-]+/.test(parsed.pathname);
    return isInstagram && isReelOrPost;
  } catch {
    return false;
  }
}

function safeNormalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    let cleanUrl = parsed.origin + parsed.pathname;
    // Lowercase hostname and remove trailing slash
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    return cleanUrl;
  } catch {
    return url.trim();
  }
}

async function fetchInstagramOpenGraph(url: string): Promise<{ title?: string; image?: string } | null> {
  try {
    console.log(`[OpenGraph] Fetching Instagram preview for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.log(`[OpenGraph] Instagram fetch failed with status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const ogData: Record<string, string> = {};
    
    const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/gi;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
      ogData[match[1]] = match[2]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
    
    console.log('[OpenGraph] Extracted Instagram metadata:', {
      title: ogData.title,
      image: ogData.image
    });

    return {
      title: ogData.title || undefined,
      image: ogData.image || undefined,
    };
  } catch (err) {
    console.error('[OpenGraph] Error scraping Instagram page:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[transcribe-instagram] Unauthorized request - no auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    if (token !== supabaseServiceKey) {
      // Validate user JWT
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.warn('[transcribe-instagram] Unauthorized request - invalid token:', authError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { post_id, url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!isInstagramReelUrl(url)) {
      console.warn(`[transcribe-instagram] Invalid Instagram Reel URL: ${url}`);
      return new Response(JSON.stringify({ success: false, error: 'invalid_url' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const superdataKey = Deno.env.get('SUPADATA_API_KEY');
    if (!superdataKey) {
      console.error('[transcribe-instagram] SUPADATA_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Supadata API key missing' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[transcribe-instagram] Fetching transcript from Supadata...`);
    const apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'x-api-key': superdataKey
      }
    });

    if (response.status === 429) {
      console.warn('[transcribe-instagram] Supadata API rate limit exceeded');
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Supadata API rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let fullTranscript = '';
    if (response.ok) {
      const data = await response.json();
      if (data.content && Array.isArray(data.content)) {
        fullTranscript = data.content
          .map((segment: { text: string }) => segment.text)
          .join(' ')
          .trim();
        console.log(`[transcribe-instagram] Successfully transcribed ${fullTranscript.length} chars`);
      } else {
        console.log('[transcribe-instagram] Empty content returned from Supadata, saving empty string');
      }
    } else {
      console.log(`[transcribe-instagram] Supadata API returned ${response.status}, saving empty string`);
    }

    // Try to scrape OG tags for image and title (best effort)
    const ogTags = await fetchInstagramOpenGraph(url);
    
    let imageMetadata: any = null;
    const reelImage = ogTags?.image || null;
    if (reelImage && reelImage.length > 5) {
      try {
        console.log(`[transcribe-instagram] 📸 Classifying Reel cover metadata: ${reelImage}`);
        imageMetadata = await classifyLinkPreviewImage(reelImage);
      } catch (classifyErr) {
        console.warn(`[transcribe-instagram] Failed to classify image ${reelImage}:`, classifyErr);
      }
    }
    
    const updatePayload: Record<string, any> = {
      article_content: fullTranscript,
      post_type: 'instagram_reel',
      preview_fetched_at: new Date().toISOString(),
      preview_img_width: imageMetadata?.width ?? null,
      preview_img_height: imageMetadata?.height ?? null,
      preview_img_ratio: imageMetadata?.ratio ?? null,
      preview_img_orientation: imageMetadata?.orientation ?? null,
      preview_img_ambient_url: imageMetadata?.ambient_url ?? null,
    };
    
    if (ogTags?.title) {
      updatePayload.shared_title = ogTags.title;
    }
    if (ogTags?.image) {
      updatePayload.preview_img = ogTags.image;
    }
    try {
      updatePayload.hostname = new URL(url).hostname.replace(/^www\./, '');
    } catch {}

    if (post_id) {
      console.log(`[transcribe-instagram] Updating post ${post_id} in DB...`);
      const { error: dbError } = await supabase
        .from('posts')
        .update(updatePayload)
        .eq('id', post_id);

      if (dbError) {
        console.error('[transcribe-instagram] DB update failed:', dbError);
        return new Response(JSON.stringify({ error: 'database_update_failed', details: dbError.message }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log('[transcribe-instagram] No post_id provided, skipping DB posts update');
    }

    // Upsert into content_cache so generate-qa can find the transcript text via source_url
    const normalizedUrl = safeNormalizeUrl(url);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days cache TTL

    const cachePayload = {
      source_url: normalizedUrl,
      source_type: 'instagram_reel',
      content_text: fullTranscript,
      title: ogTags?.title || null,
      meta_image_url: reelImage,
      meta_image_width: imageMetadata?.width ?? null,
      meta_image_height: imageMetadata?.height ?? null,
      meta_image_ratio: imageMetadata?.ratio ?? null,
      meta_image_orientation: imageMetadata?.orientation ?? null,
      meta_image_ambient_url: imageMetadata?.ambient_url ?? null,
      meta_hostname: updatePayload.hostname || 'instagram.com',
      expires_at: expiresAt.toISOString()
    };

    console.log(`[transcribe-instagram] Upserting cache for URL ${normalizedUrl}...`);
    const { error: cacheError } = await supabase
      .from('content_cache')
      .upsert(cachePayload, { onConflict: 'source_url' });

    if (cacheError) {
      console.warn('[transcribe-instagram] ⚠️ content_cache upsert failed:', cacheError.message);
    } else {
      console.log('[transcribe-instagram] ✅ content_cache updated successfully');
    }

    console.log(`[transcribe-instagram] Success`);
    return new Response(JSON.stringify({ 
      success: true, 
      transcript_length: fullTranscript.length,
      transcript: fullTranscript
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in transcribe-instagram function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
