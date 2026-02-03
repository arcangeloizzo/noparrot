import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_VIDEO_DURATION_SEC = 180; // 3 minuti
const WHISPER_MAX_SIZE = 25 * 1024 * 1024; // 25MB

// =====================================================
// DEEPGRAM TRANSCRIPTION (supports up to 2GB via URL)
// =====================================================
async function transcribeWithDeepgram(
  mediaUrl: string, 
  apiKey: string
): Promise<{ transcript: string; language: string; confidence: number }> {
  console.log('[extract-media-text] Calling Deepgram API...');
  
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=it&detect_language=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: mediaUrl }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  const language = data.results?.channels?.[0]?.detected_language || 'it';
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
  
  return { transcript, language, confidence };
}

// =====================================================
// WHISPER TRANSCRIPTION (fallback, max 25MB)
// =====================================================
async function transcribeWithWhisper(
  mediaUrl: string,
  apiKey: string
): Promise<{ transcript: string; language: string; fileSize: number }> {
  console.log('[extract-media-text] Downloading video for Whisper...');
  const videoResponse = await fetch(mediaUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }
  
  const videoBlob = await videoResponse.blob();
  const fileSize = videoBlob.size;
  console.log(`[extract-media-text] Video downloaded: ${fileSize} bytes`);
  
  if (fileSize > WHISPER_MAX_SIZE) {
    throw new Error(`file_too_large: ${fileSize} > ${WHISPER_MAX_SIZE}`);
  }
  
  const formData = new FormData();
  formData.append('file', videoBlob, 'video.mp4');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  
  console.log('[extract-media-text] Calling Whisper API...');
  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    let errorData;
    try { errorData = JSON.parse(errorText); } catch {}
    
    const isQuotaError = whisperResponse.status === 429 || 
                         errorData?.error?.code === 'insufficient_quota';
    
    if (isQuotaError) {
      throw new Error('whisper_quota_exceeded');
    }
    throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
  }
  
  const whisperData = await whisperResponse.json();
  const transcript = whisperData.text || '';
  const language = whisperData.language || 'unknown';
  
  return { transcript, language, fileSize };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
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
                          extractedText.length > 120 && 
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
    // VIDEO TRANSCRIPTION (Deepgram primary, Whisper fallback)
    // =====================================================
    if (extractionType === 'transcript') {
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
      
      let transcript = '';
      let detectedLanguage = 'unknown';
      let provider = '';
      let deepgramError: string | null = null;
      
      // STRATEGIA: Deepgram primario (URL-based, fino a 2GB)
      if (deepgramApiKey) {
        console.log('[extract-media-text] Using Deepgram (URL-based, max 2GB)');
        try {
          const result = await transcribeWithDeepgram(mediaUrl, deepgramApiKey);
          transcript = result.transcript;
          detectedLanguage = result.language;
          provider = 'deepgram-nova-2';
          console.log(`[extract-media-text] Deepgram success: ${transcript.length} chars, lang: ${detectedLanguage}`);
        } catch (err) {
          deepgramError = err instanceof Error ? err.message : String(err);
          console.error('[extract-media-text] Deepgram failed:', deepgramError);
          // Continua a Whisper fallback
        }
      }
      
      // FALLBACK: Whisper per file piccoli se Deepgram non disponibile/fallito
      if (!transcript && openaiApiKey) {
        console.log('[extract-media-text] Falling back to Whisper (download required, max 25MB)');
        try {
          const result = await transcribeWithWhisper(mediaUrl, openaiApiKey);
          transcript = result.transcript;
          detectedLanguage = result.language;
          provider = 'whisper-1';
          console.log(`[extract-media-text] Whisper success: ${transcript.length} chars, lang: ${detectedLanguage}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[extract-media-text] Whisper failed:', errorMsg);
          
          // Gestione errori specifici
          if (errorMsg.includes('file_too_large')) {
            await supabase.from('media').update({
              extracted_status: 'failed',
              extracted_meta: { 
                error: 'file_too_large',
                deepgram_error: deepgramError,
                message: 'File troppo grande per la trascrizione'
              }
            }).eq('id', mediaId);
            
            return new Response(
              JSON.stringify({ success: false, error: 'file_too_large' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (errorMsg.includes('whisper_quota_exceeded')) {
            await supabase.from('media').update({
              extracted_status: 'failed',
              extracted_meta: { 
                error: 'service_unavailable',
                deepgram_error: deepgramError,
                message: 'Servizio temporaneamente non disponibile'
              }
            }).eq('id', mediaId);
            
            return new Response(
              JSON.stringify({ success: false, error: 'service_unavailable' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Errore generico
          await supabase.from('media').update({
            extracted_status: 'failed',
            extracted_meta: { 
              error: 'transcription_failed',
              deepgram_error: deepgramError,
              whisper_error: errorMsg
            }
          }).eq('id', mediaId);
          
          return new Response(
            JSON.stringify({ success: false, error: 'transcription_failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Nessun provider disponibile
      if (!transcript && !deepgramApiKey && !openaiApiKey) {
        console.error('[extract-media-text] No transcription service configured');
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: 'service_not_configured' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'service_not_configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const isValidTranscript = transcript.length > 120;
      
      console.log(`[extract-media-text] Final result: ${transcript.length} chars, valid: ${isValidTranscript}, provider: ${provider}`);
      
      await supabase.from('media').update({
        extracted_text: isValidTranscript ? transcript : null,
        extracted_status: isValidTranscript ? 'done' : 'failed',
        extracted_kind: 'transcript',
        extracted_meta: {
          provider,
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
          provider,
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
