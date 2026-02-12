import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      ? 'Neon su sfondo scuro (#0a0a0a), alto contrasto, accenti ciano e magenta'
      : 'Deep Blue (#1e3a5f) e Slate (#64748b) su sfondo chiaro (#f8fafc), elegante e professionale';

    const systemPrompt = `Agisci come un Expert Visual Content Strategist e Information Designer.
Il tuo compito è tradurre l'analisi testuale fornita in un'infografica minimalista ad alto impatto.
Estetica: Premium Tech, pulita, moderna.
Linee Guida:
- Analisi Semantica: identifica 3 pilastri chiave nel testo.
- Layout: Verticale, con titolo d'impatto in alto, 3 sezioni iconografiche con icone minimali e testo sintetico, e un grafico di sintesi finale in basso.
- Palette: ${paletteInstruction}
- Tipografia: Sans-serif moderna (come Helvetica o Inter), numeri grandi e bold per dati chiave.
- Dimensioni: Ottimizzata per mobile (formato verticale 9:16).
- NO watermark, NO logo, NO testo "infografica" nel titolo.

Genera SOLO l'immagine dell'infografica, senza alcun testo di accompagnamento.

Dati di Input (Testo del Creator):
${truncatedText}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Infographic] Missing LOVABLE_API_KEY');
      return new Response(JSON.stringify({ error: 'Configurazione server incompleta' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Infographic] Generating for user:', userId, 'theme:', theme);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/nano-banana-pro',
        messages: [{ role: 'user', content: systemPrompt }],
        modalities: ['image', 'text']
      }),
      signal: AbortSignal.timeout(90000) // 90s timeout
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error('[Infographic] AI error:', status, errorText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit superato, riprova tra poco', status: 429 }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Crediti AI esauriti', status: 402 }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'Impossibile generare l\'infografica' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await aiResponse.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error('[Infographic] No image in response');
      return new Response(JSON.stringify({ error: 'Impossibile generare l\'infografica' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract base64
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.error('[Infographic] Invalid base64 format');
      return new Response(JSON.stringify({ error: 'Formato immagine non valido' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const imageFormat = base64Match[1];
    const base64Data = base64Match[2];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to storage using service role for reliability
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const fileName = `${userId}/infographic-${Date.now()}.${imageFormat}`;
    const { error: uploadError } = await adminClient.storage
      .from('user-media')
      .upload(fileName, binaryData, {
        contentType: `image/${imageFormat}`,
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
        mime: `image/${imageFormat}`,
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Infographic] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
