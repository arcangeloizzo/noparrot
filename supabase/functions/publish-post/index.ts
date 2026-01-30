// Lovable Cloud Function: publish-post
// Creates a post with DB-backed idempotency to prevent duplicates on crash/retry
// Security hardened with input sanitization

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORIES = [
  'Politica', 'Economia', 'Tecnologia', 'Sport', 'Cultura',
  'Scienza', 'Ambiente', 'Società', 'Esteri', 'Salute'
];

// ========================================================================
// INPUT SANITIZATION UTILITIES
// ========================================================================

/**
 * Sanitizes HTML content by removing potentially dangerous tags and attributes.
 * This is a simple sanitizer that strips tags - for a production app, consider DOMPurify.
 */
function sanitizeContent(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove script tags and their content
  let clean = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  clean = clean.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  clean = clean.replace(/javascript\s*:/gi, '');
  
  // Remove data: protocol (potential XSS vector)
  clean = clean.replace(/data\s*:/gi, 'data-blocked:');
  
  return clean.trim();
}

/**
 * Validates URL protocol - only allows http:// and https://
 */
function isValidUrlProtocol(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes and validates a URL, returning null if invalid.
 */
function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  
  // Block dangerous protocols
  const lowerUrl = trimmed.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('data:') || 
      lowerUrl.startsWith('vbscript:') ||
      lowerUrl.startsWith('file:')) {
    return null;
  }
  
  // Validate it's a proper URL with allowed protocol
  if (!isValidUrlProtocol(trimmed)) return null;
  
  return trimmed;
}

/**
 * Validates UUID format
 */
function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// ========================================================================
// CLASSIFICATION LOGIC
// ========================================================================

async function classifyAndUpdatePost(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  content: string,
  reqId: string
) {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.warn(`[publish-post:${reqId}] stage=classify no API key`);
      return;
    }

    const prompt = `Classifica il seguente contenuto in UNA di queste categorie: ${CATEGORIES.join(', ')}.

Contenuto:
"""
${content.substring(0, 2000)}
"""

Rispondi con UNA SOLA PAROLA: la categoria più appropriata.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      console.warn(`[publish-post:${reqId}] stage=classify API error ${response.status}`);
      return;
    }

    const data = await response.json();
    const rawCategory = data.choices?.[0]?.message?.content?.trim();
    
    // Match to valid category
    const category = CATEGORIES.find(c => 
      c.toLowerCase() === rawCategory?.toLowerCase()
    );

    if (category) {
      const { error } = await supabase
        .from('posts')
        .update({ category })
        .eq('id', postId);

      if (error) {
        console.warn(`[publish-post:${reqId}] stage=classify update error`, error.message);
      } else {
        console.log(`[publish-post:${reqId}] stage=classify done category=${category}`);
      }
    } else {
      console.log(`[publish-post:${reqId}] stage=classify no match raw="${rawCategory}"`);
    }
  } catch (err) {
    console.warn(`[publish-post:${reqId}] stage=classify error`, err);
  }
}

type PublishPostBody = {
  content: string
  sharedUrl?: string | null
  sharedTitle?: string | null
  previewImg?: string | null
  articleContent?: string | null
  quotedPostId?: string | null
  mediaIds?: string[]
  idempotencyKey?: string | null
  isIntent?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[publish-post:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('authorization') || ''
    const hasAuth = authHeader.length > 20

    console.log(`[publish-post:${reqId}] hasAuth=${hasAuth}`)

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    let body: PublishPostBody
    try {
      body = (await req.json()) as PublishPostBody
    } catch (parseErr) {
      console.error(`[publish-post:${reqId}] stage=parse_json error`, parseErr)
      return new Response(JSON.stringify({ error: 'invalid_json', stage: 'parse' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawContent = typeof body.content === 'string' ? body.content : ''
    const content = rawContent.trim()

    // Allow empty content ONLY for reshares, link-only posts, or media-only posts.
    // This prevents "ghost" text-only posts, while letting users share without adding a comment.
    const mediaCount = Array.isArray(body.mediaIds) ? body.mediaIds.filter(Boolean).length : 0
    const allowEmpty = !!body.quotedPostId || !!body.sharedUrl || mediaCount > 0
    if (!content && !allowEmpty) {
      console.error(`[publish-post:${reqId}] stage=validate empty content`)
      return new Response(JSON.stringify({ error: 'content_required', stage: 'validate' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const finalContent = content || ''

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      console.warn(`[publish-post:${reqId}] stage=auth failed`, userErr?.message || 'no user')
      return new Response(JSON.stringify({ error: 'unauthorized', stage: 'auth', details: userErr?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const idempotencyKey = body.idempotencyKey || null

    console.log(`[publish-post:${reqId}] stage=start`, {
      userId: user.id,
      hasSharedUrl: !!body.sharedUrl,
      mediaCount: Array.isArray(body.mediaIds) ? body.mediaIds.length : 0,
      contentLen: finalContent.length,
      idempotencyKey,
    })

    // IDEMPOTENCY CHECK: Use DB table with unique constraint
    if (idempotencyKey) {
      // First check if this key already exists and has a post_id
      const { data: existing, error: checkErr } = await supabase
        .from('publish_idempotency')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)
        .maybeSingle()

      if (checkErr) {
        console.warn(`[publish-post:${reqId}] stage=idempotency_check error`, checkErr.message)
      }

      if (existing?.post_id) {
        console.log(`[publish-post:${reqId}] stage=idempotency_hit returning existing`, {
          postId: existing.post_id,
        })
        return new Response(
          JSON.stringify({ postId: existing.post_id, idempotent: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Try to reserve this key (will fail on duplicate due to unique index)
      const { error: reserveErr } = await supabase
        .from('publish_idempotency')
        .insert({ user_id: user.id, key: idempotencyKey, post_id: null })

      if (reserveErr) {
        console.log(`[publish-post:${reqId}] stage=reserve conflict code=${reserveErr.code}`, reserveErr.message)
        
        const { data: raceCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (raceCheck?.post_id) {
          console.log(`[publish-post:${reqId}] stage=race_resolved returning existing`, {
            postId: raceCheck.post_id,
          })
          return new Response(
            JSON.stringify({ postId: raceCheck.post_id, idempotent: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        
        // Key exists but no post_id yet - another request is in progress
        await new Promise(r => setTimeout(r, 500))
        
        const { data: retryCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (retryCheck?.post_id) {
          console.log(`[publish-post:${reqId}] stage=retry_resolved returning existing`, {
            postId: retryCheck.post_id,
          })
          return new Response(
            JSON.stringify({ postId: retryCheck.post_id, idempotent: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        
        console.warn(`[publish-post:${reqId}] stage=idempotency_race_unresolved proceeding anyway`)
      } else {
        console.log(`[publish-post:${reqId}] stage=reserve_ok key reserved`)
      }
    }

    // Sanitize all inputs before insertion
    const sanitizedContent = sanitizeContent(finalContent).substring(0, 5000);
    let sanitizedSharedUrl = sanitizeUrl(body.sharedUrl);
    let sanitizedPreviewImg = sanitizeUrl(body.previewImg);
    let sanitizedTitle = body.sharedTitle 
      ? sanitizeContent(String(body.sharedTitle)).substring(0, 500) 
      : null;
    let sanitizedArticle = body.articleContent 
      ? sanitizeContent(String(body.articleContent)).substring(0, 10000) 
      : null;
    
    // Validate quotedPostId is a valid UUID if provided
    const validQuotedPostId = body.quotedPostId && isValidUuid(body.quotedPostId) 
      ? body.quotedPostId 
      : null;

    // ========================================================================
    // FIX: For editorial posts (focus://), fetch missing data from daily_focus
    // CRITICAL: Check body.sharedUrl FIRST, before sanitizeUrl() blocks non-http protocols!
    // ========================================================================
    const rawSharedUrl = body.sharedUrl || '';
    const isEditorialUrl = rawSharedUrl.startsWith('focus://daily/') || 
                           rawSharedUrl.startsWith('focus://') ||
                           rawSharedUrl.startsWith('editorial://');
    
    if (isEditorialUrl) {
      console.log(`[publish-post:${reqId}] stage=editorial_detected url=${rawSharedUrl.slice(0, 50)}`);
      
      // For focus:// URLs, bypass sanitizeUrl (which blocks non-http) 
      sanitizedSharedUrl = rawSharedUrl;
      
      // Extract focus ID and fetch content if missing
      if (!sanitizedArticle || !sanitizedTitle) {
        const focusId = rawSharedUrl
          .replace('focus://daily/', '')
          .replace('focus://', '')
          .replace('editorial://', '');
        
        if (focusId) {
          console.log(`[publish-post:${reqId}] stage=editorial_fetch focusId=${focusId}`);
          
          try {
            const { data: focusData, error: focusErr } = await supabase
              .from('daily_focus')
              .select('title, summary, deep_content, image_url')
              .eq('id', focusId)
              .maybeSingle();
            
            if (focusErr) {
              console.warn(`[publish-post:${reqId}] stage=editorial_fetch_error`, focusErr.message);
            } else if (focusData) {
              // Use data from daily_focus if missing in request
              if (!sanitizedTitle && focusData.title) {
                sanitizedTitle = sanitizeContent(focusData.title).substring(0, 500);
                console.log(`[publish-post:${reqId}] stage=editorial_title_set title="${sanitizedTitle?.slice(0, 30)}..."`);
              }
              if (!sanitizedArticle) {
                const editorialContent = focusData.deep_content || focusData.summary || '';
                // Clean [SOURCE:N] markers
                sanitizedArticle = sanitizeContent(editorialContent.replace(/\[SOURCE:[\d,\s]+\]/g, '')).substring(0, 10000);
                console.log(`[publish-post:${reqId}] stage=editorial_content_set len=${sanitizedArticle?.length}`);
              }
              if (!sanitizedPreviewImg && focusData.image_url) {
                sanitizedPreviewImg = focusData.image_url; // Skip sanitizeUrl for internal URLs
                console.log(`[publish-post:${reqId}] stage=editorial_image_set`);
              }
            } else {
              console.warn(`[publish-post:${reqId}] stage=editorial_not_found focusId=${focusId}`);
            }
          } catch (editorialErr) {
            console.warn(`[publish-post:${reqId}] stage=editorial_fetch_exception`, editorialErr);
          }
        }
      }
    }

    const insertPayload = {
      content: sanitizedContent,
      author_id: user.id,
      shared_url: sanitizedSharedUrl,
      shared_title: sanitizedTitle,
      preview_img: sanitizedPreviewImg,
      article_content: sanitizedArticle,
      quoted_post_id: validQuotedPostId,
      category: null as string | null,
      is_intent: body.isIntent || false,
    }

    console.log(`[publish-post:${reqId}] stage=insert_start contentLen=${insertPayload.content.length}`)

    const { data: inserted, error: insertErr } = await supabase
      .from('posts')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (insertErr) {
      console.error(`[publish-post:${reqId}] stage=insert_error`, insertErr.code, insertErr.message)
      return new Response(JSON.stringify({ 
        error: 'insert_failed', 
        stage: 'insert',
        code: insertErr.code,
        details: insertErr.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!inserted?.id) {
      console.error(`[publish-post:${reqId}] stage=insert_no_id no id returned`)
      return new Response(JSON.stringify({ error: 'insert_no_id', stage: 'insert' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[publish-post:${reqId}] stage=insert_ok postId=${inserted.id}`)

    // Update idempotency record with the new post_id
    if (idempotencyKey) {
      const { error: updateErr } = await supabase
        .from('publish_idempotency')
        .update({ post_id: inserted.id })
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)

      if (updateErr) {
        console.warn(`[publish-post:${reqId}] stage=idempotency_update_error`, updateErr.message)
      } else {
        console.log(`[publish-post:${reqId}] stage=idempotency_update_ok`)
      }
    }

    // Link media (best-effort; never block publish)
    const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds.filter(Boolean) : []
    if (mediaIds.length > 0) {
      const rows = mediaIds.map((mediaId, idx) => ({
        post_id: inserted.id,
        media_id: mediaId,
        order_idx: idx,
      }))

      const { error: mediaErr } = await supabase.from('post_media').insert(rows)
      if (mediaErr) {
        console.warn(`[publish-post:${reqId}] stage=media_link_error`, mediaErr.message)
      } else {
        console.log(`[publish-post:${reqId}] stage=media_link_ok count=${mediaIds.length}`)
      }
    }

    // NOTE: Share count increment is handled by database trigger 'increment_shares_on_reshare'
    // triggered automatically on INSERT when quoted_post_id is set
    // No need to call increment_post_shares RPC here (would cause double counting)

    // ========================================================================
    // PHASE 2: Populate metadata for posts with shared_url (using await, not fire-and-forget)
    // This ensures Deno runtime doesn't kill the process before metadata is saved
    // ========================================================================
    if (insertPayload.shared_url && !insertPayload.shared_title && !insertPayload.preview_img) {
      try {
        console.log(`[publish-post:${reqId}] stage=preview_fetch starting for ${insertPayload.shared_url}`);
        
        const previewResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-article-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ url: insertPayload.shared_url }),
        });
        
        if (previewResponse.ok) {
          const preview = await previewResponse.json();
          
          // Extract hostname from URL
          let extractedHostname = '';
          try {
            extractedHostname = new URL(insertPayload.shared_url).hostname.replace(/^www\./, '');
          } catch {}
          
          const updatePayload: Record<string, unknown> = {
            shared_title: preview.title || null,
            preview_img: preview.image || preview.previewImg || null,
            hostname: extractedHostname || preview.hostname || null,
            preview_fetched_at: new Date().toISOString()
          };
          
          const { error: updateErr } = await supabase
            .from('posts')
            .update(updatePayload)
            .eq('id', inserted.id);
          
          if (updateErr) {
            console.warn(`[publish-post:${reqId}] stage=preview_update_error`, updateErr.message);
          } else {
            console.log(`[publish-post:${reqId}] stage=preview_populated title="${preview.title?.slice(0, 30)}..." img=${!!updatePayload.preview_img}`);
          }
        } else {
          console.warn(`[publish-post:${reqId}] stage=preview_fetch_failed status=${previewResponse.status}`);
        }
      } catch (previewErr) {
        console.warn(`[publish-post:${reqId}] stage=preview_fetch_error`, previewErr);
      }
    }

    // Background classification (non-blocking)
    const contentToClassify = [
      insertPayload.content,
      insertPayload.shared_title,
      insertPayload.article_content
    ].filter(Boolean).join('\n\n');

    if (contentToClassify.length > 20) {
      // Fire and forget - don't await
      classifyAndUpdatePost(supabase, inserted.id, contentToClassify, reqId);
      
      // Also assign semantic topic for trending (non-blocking)
      fetch(`${supabaseUrl}/functions/v1/assign-post-topic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          postId: inserted.id,
          content: insertPayload.content,
          sharedTitle: insertPayload.shared_title,
          sharedUrl: insertPayload.shared_url,
        }),
      }).catch(err => console.warn(`[publish-post:${reqId}] assign-post-topic call failed:`, err));
    }

    console.log(`[publish-post:${reqId}] stage=done postId=${inserted.id}`)

    return new Response(JSON.stringify({ postId: inserted.id, idempotent: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(`[publish-post:${reqId}] stage=fatal`, e)
    return new Response(JSON.stringify({ error: 'fatal', stage: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
