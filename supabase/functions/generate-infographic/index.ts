import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image, decode } from "https://deno.land/x/imagescript@1.2.9/mod.ts";
import { LOGO_BASE64 } from "./logo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub as string;

    const { text, theme } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return new Response(JSON.stringify({ error: 'Testo troppo breve (min 50 caratteri)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Truncate to prevent abuse
    const truncatedText = text.slice(0, 5000);

    const paletteInstruction = theme === 'dark'
      ? 'Neon Minimal: Sfondo nero assoluto (#000000), testo bianco brillante, accenti ciano neon.'
      : 'Clean Modern: Sfondo bianco (#ffffff), testo nero, accenti blu scuro.';

    const systemPrompt = `Sei un esperto di Visual Communication.
Il tuo compito è creare un POSTER DIGITALE MINIMALISTA.
IMPORTANTE: Il testo deve essere PERFETTO, senza errori ortografici.

REGOLE CRITICHE:
1. POCHISSIMO TESTO: Massimo 5-6 parole per punto.
2. TITOLI GRANDI E LEGGIBILI.
3. VISUAL PRIMACY: Usa icone e numeri grandi.
4. STILE: "${paletteInstruction}"

Genera SOLO l'immagine.

TESTO:
${truncatedText}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Infographic] Missing LOVABLE_API_KEY');
      return new Response(JSON.stringify({ error: 'Configurazione server incompleta' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Infographic] Generating with Google Imagen 3 (Revert Request) for user:', userId);

    // Revert to Google Imagen 3 via Lovable
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/imagen-3',
        prompt: systemPrompt,
        size: "1024x1792",
        n: 1
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error('[Infographic] AI error:', status, errorText);
      return new Response(JSON.stringify({ error: `Errore AI (${status}): ${errorText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await aiResponse.json();
    const imageData = data.data?.[0]?.url;

    if (!imageData) {
      console.error('[Infographic] No image URL in response');
      return new Response(JSON.stringify({ error: 'Nessuna immagine generata' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Download image
    let binaryData;
    let finalFormat = 'png';
    let watermarkStatus = 'skipped';

    try {
      const imgResp = await fetch(imageData);
      const imgBuffer = await imgResp.arrayBuffer();
      binaryData = new Uint8Array(imgBuffer);
    } catch (e: any) {
      console.error('[Infographic] Failed to download generated image:', e);
      return new Response(JSON.stringify({ error: 'Errore download immagine' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let finalBuffer = binaryData;

    // --- Watermark Processing ---
    try {
      console.log('[Infographic] Processing watermark...');
      const infograph = await decode(binaryData);

      // Decode logo
      const cleanLogoBase64 = LOGO_BASE64.replace(/[^a-zA-Z0-9+/=]/g, '');
      const logoBinary = Uint8Array.from(atob(cleanLogoBase64), c => c.charCodeAt(0));
      const logo = await decode(logoBinary);

      // Resize logo to 20% width (standard visibility)
      const targetLogoWidth = Math.max(150, Math.round(infograph.width * 0.20));
      logo.resize(targetLogoWidth, Image.RESIZE_AUTO);

      // Create a white background container for the logo to ensure visibility
      // Padding of 20px around the logo
      const bgPadding = 20;
      const bgWidth = logo.width + (bgPadding * 2);
      const bgHeight = logo.height + (bgPadding * 2);

      // Create white background with 90% opacity
      const logoBackground = new Image(bgWidth, bgHeight) as any;
      logoBackground.fill(0xFFFFFFE6); // White, High Opacity

      // Composite logo onto white background (centered)
      logoBackground.composite(logo, bgPadding, bgPadding);
      
      // Position: Top-Right with 5% padding
      const padding = Math.round((infograph as any).width * 0.05);
      const x = (infograph as any).width - logoBackground.width - padding;
      const y = padding;

      // Composite the background (with logo) onto the infographic
      (infograph as any).composite(logoBackground, x, y);

      finalBuffer = await infograph.encode() as Uint8Array;
      watermarkStatus = 'success (with background)';
      console.log('[Infographic] Watermark applied with background');
    } catch (err: any) {
      console.error('[Infographic] Watermark error:', err);
      watermarkStatus = `failed: ${err.message}`;
    }

    // Upload to storage using service role for reliability
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const fileName = `${userId}/infographic-${Date.now()}.${finalFormat}`;
    const { error: uploadError } = await adminClient.storage
      .from('user-media')
      .upload(fileName, finalBuffer, {
        contentType: `image/${finalFormat}`,
        upsert: false
      });

    if (uploadError) {
      console.error('[Infographic] Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio dell\'immagine' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: publicUrlData } = adminClient.storage
      .from('user-media')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Insert media record
    const { data: mediaData, error: mediaError } = await adminClient
      .from('media')
      .insert({
        owner_id: userId,
        type: 'image',
        mime: `image/${finalFormat}`,
        url: publicUrl,
        extracted_status: 'idle',
        extracted_kind: null
      })
      .select('id')
      .single();

    if (mediaError) {
      console.error('[Infographic] Media insert error:', mediaError);
      return new Response(JSON.stringify({ error: 'Errore nel salvataggio del media' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Infographic] Success - mediaId:', mediaData.id);

    return new Response(JSON.stringify({ mediaId: mediaData.id, url: publicUrl }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Debug-Watermark': watermarkStatus
      }
    });

  } catch (error: any) {
    console.error('[Infographic] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
