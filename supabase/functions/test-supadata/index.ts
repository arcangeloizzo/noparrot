import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supadataKey = Deno.env.get('SUPADATA_API_KEY');
    
    console.log('[Test Supadata] 🧪 Making first request to activate account...');
    console.log('[Test Supadata] 🔑 Using API key:', supadataKey ? `${supadataKey.substring(0, 10)}...` : 'NOT FOUND');
    
    const testVideoId = 'dQw4w9WgXcQ';
    const url = `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${testVideoId}`;
    
    console.log('[Test Supadata] 📡 Calling:', url);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': supadataKey!,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw_response: responseText };
    }
    
    console.log('[Test Supadata] 📊 Response status:', response.status);
    console.log('[Test Supadata] 📊 Response data:', data);

    if (response.ok) {
      console.log('[Test Supadata] ✅ SUCCESS! Account activated!');
    } else {
      console.log('[Test Supadata] ❌ Failed with status:', response.status);
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        status: response.status,
        message: response.ok 
          ? '✅ Account Supadata.ai attivato con successo!' 
          : `❌ Errore ${response.status}`,
        data 
      }, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always return 200 to see the actual response
      }
    );
  } catch (error) {
    console.error('[Test Supadata] 💥 Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack 
      }, null, 2),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
