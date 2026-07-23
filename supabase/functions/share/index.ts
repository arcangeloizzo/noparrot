// Supabase Edge Function: share
// Serves dynamic OpenGraph HTML for shared NoParrot links.
// Supports: post, il_punto, challenge, profile.
//
// The response is HTML with an explicit `Content-Type: text/html; charset=utf-8`
// header so browsers execute the meta redirect instead of showing source and
// crawlers parse OG tags without mojibake.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_APP_URL = 'https://noparrot.lovable.app';
// Configurable via secret (e.g. preview deployments). Falls back to production.
const APP_URL = (Deno.env.get('PUBLIC_APP_URL') ?? DEFAULT_APP_URL).replace(/\/+$/, '');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen).trim() + '\u2026';
}

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
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${safeTitle} \u2014 ${siteName}</title>
  <meta name="description" content="${safeDesc}"/>
  <link rel="canonical" href="${safeUrl}"/>

  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${safeTitle}"/>
  <meta property="og:description" content="${safeDesc}"/>
  <meta property="og:image" content="${safeImage}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:url" content="${safeUrl}"/>
  <meta property="og:site_name" content="${siteName}"/>

  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${safeTitle}"/>
  <meta name="twitter:description" content="${safeDesc}"/>
  <meta name="twitter:image" content="${safeImage}"/>

  <meta http-equiv="refresh" content="0;url=${safeRedirect}"/>
  <script>window.location.replace(${JSON.stringify(safeRedirect)});</script>
</head>
<body style="background:#0E1522;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <p>Reindirizzamento a NoParrot\u2026</p>
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

    // Brand fallback (1200x630, hosted in public/). Never apple-touch-icon.
    const defaultImage = `${DEFAULT_APP_URL}/og-default.png`;
    const ilPuntoImage = `${DEFAULT_APP_URL}/og-ilpunto.png`;

    let title = 'NoParrot';
    let description = 'Read. Understand. Then share.';
    let image = defaultImage;
    let redirectUrl = APP_URL;
    let canonicalUrl = APP_URL;

    if (type === 'il_punto') {
      redirectUrl = `${APP_URL}/?focus=${id}`;
      canonicalUrl = `${DEFAULT_APP_URL}/?focus=${id}`;
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
    } else if (type === 'post') {
      redirectUrl = `${APP_URL}/post/${id}`;
      canonicalUrl = `${DEFAULT_APP_URL}/post/${id}`;

      const { data: post, error } = await supabase
        .from('posts')
        .select('title, content, shared_title, preview_img, post_type, post_media(order_idx, media(url, thumbnail_url, type))')
        .eq('id', id)
        .maybeSingle();

      if (!error && post) {
        title = truncate(post.title || post.shared_title || 'Post su NoParrot', 90);
        description = truncate(post.content || 'Leggi e condividi su NoParrot', 160);

        // Fallback chain: first uploaded media (image or video thumbnail) →
        // external source preview (preview_img) → brand default.
        const pm = Array.isArray((post as any).post_media) ? (post as any).post_media : [];
        pm.sort((a: any, b: any) => (a?.order_idx ?? 0) - (b?.order_idx ?? 0));
        const firstMedia = pm[0]?.media;
        const mediaImage = firstMedia?.type === 'image'
          ? firstMedia?.url
          : (firstMedia?.thumbnail_url || null);
        image = mediaImage || post.preview_img || defaultImage;
      } else {
        title = 'Post su NoParrot';
        description = 'Leggi e condividi su NoParrot';
      }
    } else if (type === 'challenge') {
      redirectUrl = `${APP_URL}/post/${id}`;
      canonicalUrl = `${DEFAULT_APP_URL}/post/${id}`;

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
        if (post.preview_img) image = post.preview_img;
      } else {
        title = 'Challenge su NoParrot';
        description = 'Mettiti alla prova su NoParrot e verifica le tue conoscenze!';
      }
    } else if (type === 'profile') {
      redirectUrl = `${APP_URL}/profile/${id}`;
      canonicalUrl = `${DEFAULT_APP_URL}/profile/${id}`;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, full_name, bio, avatar_url')
        .eq('id', id)
        .maybeSingle();

      if (!error && profile) {
        const displayName = profile.full_name || profile.username || 'Utente';
        title = `Scopri i contributi di ${displayName} su NoParrot`;
        description = truncate(profile.bio || `Segui ${displayName} su NoParrot`, 160);
        if (profile.avatar_url) image = profile.avatar_url;
      } else {
        title = 'Profilo su NoParrot';
        description = 'Scopri i contributi di questo utente su NoParrot';
      }
    } else {
      redirectUrl = `${APP_URL}/?focus=${id}`;
      canonicalUrl = `${DEFAULT_APP_URL}/?focus=${id}`;
    }

    const html = buildOgHtml({
      title,
      description,
      image,
      url: canonicalUrl,
      redirectUrl,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
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