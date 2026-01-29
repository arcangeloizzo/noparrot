import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_VIDEO_DURATION_SEC = 180; // 3 minuti

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { mediaId, mediaUrl, extractionType, durationSec } = await req.json();
    
    if (!mediaId || !mediaUrl || !extractionType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[extract-media-text] Starting ${extractionType} for media ${mediaId}`);
    
    // =====================================================
    // OCR VIA GEMINI VISION
    // =====================================================
    if (extractionType === 'ocr') {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: 'Extract ALL text visible in this image. Return ONLY the text content, preserving line breaks and structure. Do not add descriptions or explanations. If no text is found, respond with exactly: NO_TEXT_FOUND' 
              },
              { 
                type: 'image_url', 
                image_url: { url: mediaUrl } 
              }
            ]
          }],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[extract-media-text] Gemini API error: ${response.status}`, errorText);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: `API error ${response.status}`, provider: 'gemini-vision' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'OCR failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content || '';
      const isValidText = extractedText && 
                          extractedText.length > 50 && 
                          !extractedText.includes('NO_TEXT_FOUND');

      console.log(`[extract-media-text] OCR result: ${extractedText.length} chars, valid: ${isValidText}`);

      await supabase.from('media').update({
        extracted_text: isValidText ? extractedText : null,
        extracted_status: isValidText ? 'done' : 'failed',
        extracted_kind: 'ocr',
        extracted_meta: {
          provider: 'gemini-vision',
          chars: extractedText.length,
          language: 'auto'
        }
      }).eq('id', mediaId);

      return new Response(
        JSON.stringify({ 
          success: isValidText, 
          chars: extractedText.length,
          status: isValidText ? 'done' : 'failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // =====================================================
    // TRASCRIZIONE VIDEO VIA OPENAI WHISPER
    // =====================================================
    if (extractionType === 'transcript') {
      // Check per API key
      if (!openaiApiKey) {
        console.error('[extract-media-text] OPENAI_API_KEY not configured');
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: 'Transcription service not configured' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Transcription service not available' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check durata video
      if (durationSec && durationSec > MAX_VIDEO_DURATION_SEC) {
        console.log(`[extract-media-text] Video too long: ${durationSec}s > ${MAX_VIDEO_DURATION_SEC}s`);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { 
            error: 'video_too_long',
            duration_sec: durationSec,
            max_duration_sec: MAX_VIDEO_DURATION_SEC
          }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'video_too_long' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Download video file
      console.log('[extract-media-text] Downloading video...');
      const videoResponse = await fetch(mediaUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      
      const videoBlob = await videoResponse.blob();
      console.log(`[extract-media-text] Video downloaded: ${videoBlob.size} bytes`);
      
      // Crea FormData per Whisper API
      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      
      // Call OpenAI Whisper API
      console.log('[extract-media-text] Calling Whisper API...');
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });
      
      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error(`[extract-media-text] Whisper API error: ${whisperResponse.status}`, errorText);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: `Whisper API error ${whisperResponse.status}`, provider: 'whisper-1' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Transcription failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const whisperData = await whisperResponse.json();
      const transcript = whisperData.text || '';
      const detectedLanguage = whisperData.language || 'unknown';
      const isValidTranscript = transcript.length > 50;
      
      console.log(`[extract-media-text] Transcript received: ${transcript.length} chars, language: ${detectedLanguage}`);
      
      await supabase.from('media').update({
        extracted_text: isValidTranscript ? transcript : null,
        extracted_status: isValidTranscript ? 'done' : 'failed',
        extracted_kind: 'transcript',
        extracted_meta: {
          provider: 'whisper-1',
          chars: transcript.length,
          language: detectedLanguage,
          duration_sec: durationSec || null
        }
      }).eq('id', mediaId);
      
      return new Response(
        JSON.stringify({ 
          success: isValidTranscript, 
          chars: transcript.length,
          language: detectedLanguage,
          status: isValidTranscript ? 'done' : 'failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid extraction type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[extract-media-text] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
