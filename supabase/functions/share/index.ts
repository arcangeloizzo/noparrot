// Supabase Edge Function: share
// Generates dynamic OpenGraph HTML for shared NoParrot links
// Supports: post, il_punto, challenge, profile
// 
// WORKAROUND: Supabase Edge Functions with --no-verify-jwt force
// Content-Type: text/plain, which prevents crawlers from parsing OG tags.
// Solution: Upload the HTML to Supabase Storage (which serves correct Content-Type)
// and redirect the crawler to that Storage URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://noparrot.lovable.app';
const STORAGE_BUCKET = 'share-previews';

// Escape HTML entities to prevent XSS in meta tags
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Truncate text to a max length, adding ellipsis if needed
function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen).trim() + '…';
}

// Build the full HTML with OG meta tags + redirect
function buildOgHtml({
  title,
  description,
  image,
  url,
  redirectUrl,
  siteName = 'NoParrot',
}: {
  title: string;
  description: string;
  image: string;
  url: string;
  redirectUrl: string;
  siteName?: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeRedirect = escapeHtml(redirectUrl);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${safeTitle} — ${siteName}</title>
  <meta name="description" content="${safeDesc}"/>

  <!-- OpenGraph -->
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${safeTitle}"/>
  <meta property="og:description" content="${safeDesc}"/>
  <meta property="og:image" content="${safeImage}"/>
  <meta property="og:url" content="${safeUrl}"/>
  <meta property="og:site_name" content="${siteName}"/>

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${safeTitle}"/>
  <meta name="twitter:description" content="${safeDesc}"/>
  <meta name="twitter:image" content="${safeImage}"/>

  <!-- Redirect real users immediately -->
  <meta http-equiv="refresh" content="0;url=${safeRedirect}"/>
  <script>window.location.replace("${safeRedirect}");</script>
</head>
<body style="background:#0A0E12;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <p>Reindirizzamento a NoParrot...</p>
    <a href="${safeRedirect}" style="color:#0A7AFF;">Clicca qui se non vieni reindirizzato</a>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type') || 'post';

    if (!id) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: APP_URL },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Default fallback image: app logo
    const defaultImage = `${APP_URL}/apple-touch-icon.png`;
    // Il Punto editorial image
    const ilPuntoImage = `${APP_URL}/og-ilpunto.png`;

    let title = 'NoParrot';
    let description = 'Read. Understand. Then share.';
    let image = defaultImage;
    let redirectUrl = APP_URL;

    // ========================================================================
    // TYPE: il_punto (editorial / daily focus)
    // ========================================================================
    if (type === 'il_punto') {
      redirectUrl = `${APP_URL}/?focus=${id}`;
      image = ilPuntoImage;

      const { data: focus, error } = await supabase
        .from('daily_focus')
        .select('title, summary')
        .eq('id', id)
        .maybeSingle();

      if (!error && focus) {
        title = `Il Punto di Oggi: ${truncate(focus.title, 80)}`;
        description = truncate(
          focus.summary?.replace(/\[SOURCE:[\d,\s]+\]/g, '') || 'Approfondimento giornaliero di NoParrot',
          160
        );
      } else {
        title = 'Il Punto di Oggi';
        description = 'Approfondimento giornaliero di NoParrot';
      }
    }

    // ========================================================================
    // TYPE: post (standard feed post)
    // ========================================================================
    else if (type === 'post') {
      redirectUrl = `${APP_URL}/post/${id}`;

      const { data: post, error } = await supabase
        .from('posts')
        .select('title, content, shared_title, preview_img, post_type')
        .eq('id', id)
        .maybeSingle();

      if (!error && post) {
        title = post.title || post.shared_title || 'Post su NoParrot';
        title = truncate(title, 90);
        description = truncate(post.content || 'Leggi e condividi su NoParrot', 160);
        if (post.preview_img) {
          image = post.preview_img;
        }
      } else {
        title = 'Post su NoParrot';
        description = 'Leggi e condividi su NoParrot';
      }
    }

    // ========================================================================
    // TYPE: challenge
    // ========================================================================
    else if (type === 'challenge') {
      redirectUrl = `${APP_URL}/post/${id}`;

      const { data: post, error } = await supabase
        .from('posts')
        .select('title, content, preview_img, challenges(thesis, title, body_text)')
        .eq('id', id)
        .maybeSingle();

      if (!error && post) {
        const challenge = Array.isArray(post.challenges)
          ? post.challenges[0]
          : post.challenges;

        const challengeLabel = challenge?.title || challenge?.thesis || post.title || post.content;
        title = `Challenge: ${truncate(challengeLabel || 'Mettiti alla prova', 80)}`;
        description = truncate(
          challenge?.body_text || post.content || 'Mettiti alla prova su NoParrot e verifica le tue conoscenze!',
          160
        );
        if (post.preview_img) {
          image = post.preview_img;
        }
      } else {
        title = 'Challenge su NoParrot';
        description = 'Mettiti alla prova su NoParrot e verifica le tue conoscenze!';
      }
    }

    // ========================================================================
    // TYPE: profile
    // ========================================================================
    else if (type === 'profile') {
      redirectUrl = `${APP_URL}/profile/${id}`;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, full_name, bio, avatar_url')
        .eq('id', id)
        .maybeSingle();

      if (!error && profile) {
        const displayName = profile.full_name || profile.username || 'Utente';
        title = `Scopri i contributi di ${displayName} su NoParrot`;
        description = truncate(profile.bio || `Segui ${displayName} su NoParrot`, 160);
        if (profile.avatar_url) {
          image = profile.avatar_url;
        }
      } else {
        title = 'Profilo su NoParrot';
        description = 'Scopri i contributi di questo utente su NoParrot';
      }
    }

    // ========================================================================
    // Fallback
    // ========================================================================
    else {
      redirectUrl = `${APP_URL}/?focus=${id}`;
    }

    // Build the canonical URL for this share page
    const canonicalUrl = `${supabaseUrl}/functions/v1/share?id=${id}&type=${type}`;

    const html = buildOgHtml({
      title,
      description,
      image,
      url: canonicalUrl,
      redirectUrl,
    });

    // ========================================================================
    // STORAGE WORKAROUND: Supabase Edge Functions with --no-verify-jwt
    // force Content-Type: text/plain, which breaks OG parsing.
    // We upload the HTML to Supabase Storage, which serves text/html correctly.
    // ========================================================================
    const fileName = `${type}_${id}.html`;

    // Upload to storage (upsert: overwrite if exists)
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, html, {
        contentType: 'text/html',
        upsert: true,
        cacheControl: '300',
      });

    if (uploadError) {
      console.error('[share] Storage upload error:', uploadError);
      // Fallback: redirect directly to app
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl },
      });
    }

    // Get public URL for the uploaded HTML
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    // Redirect crawler to the Storage-hosted HTML page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: publicUrlData.publicUrl,
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch (err) {
    console.error('[share] Fatal error:', err);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: APP_URL },
    });
  }
});
