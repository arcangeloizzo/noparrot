// Lovable Cloud Function: transcribe-audio
// Invoked asynchronously when a voice post is created. 
// Uses Deepgram to obtain a transcript for the audio, and saves it in voice_posts.
// Then triggers generate-qa for Comprehension Gate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[transcribe-audio:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // We use service role to act on the db fields, since this is a back-end worker process
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { voicePostId, retryCount = 0 } = await req.json()

    if (!voicePostId) {
      return new Response(JSON.stringify({ error: 'missing voicePostId' }), {
        status: 400, headers: corsHeaders
      })
    }

    console.log(`[transcribe-audio:${reqId}] Invoked with:`, { voicePostId, retryCount })

    // 1. Mark as processing
    await supabase.from('voice_posts').update({ transcript_status: 'processing' }).eq('id', voicePostId)

    // 2. Fetch Voice Post data to get audio URL
    const { data: voicePost, error: vpErr } = await supabase
      .from('voice_posts')
      .select('audio_url, post_id')
      .eq('id', voicePostId)
      .single()

    if (vpErr || !voicePost?.audio_url) {
      throw new Error(`Voice post not found or missing audio_url: ${vpErr?.message}`);
    }

    // 3. Obtain signed URL from storage since bucket is authenticated for writes, 
    // but maybe audio is public or private. We use createSignedUrl to ensure Deepgram can fetch it.
    // Assuming audio_url in DB is the storage path
    const { data: signedUrlData, error: signErr } = await supabase.storage
      .from('voice-audio')
      .createSignedUrl(voicePost.audio_url, 60 * 60) // valid for 1h

    if (signErr) throw new Error(`Failed to create signed URL for voice audio: ${signErr.message}`);
    const audioUrlToTranscribe = signedUrlData.signedUrl;

    console.log(`[transcribe-audio:${reqId}] Fetching audio from:`, audioUrlToTranscribe.substring(0, 160) + '...');

    // Pre-flight: HEAD request to verify the signed URL is reachable and audio bytes exist
    try {
      const head = await fetch(audioUrlToTranscribe, { method: 'HEAD' });
      console.log(`[transcribe-audio:${reqId}] audio HEAD status=${head.status} content-type=${head.headers.get('content-type')} content-length=${head.headers.get('content-length')}`);
    } catch (e) {
      console.warn(`[transcribe-audio:${reqId}] audio HEAD failed:`, e);
    }

    // 4. Call Deepgram
    const deepgramResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=it&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: audioUrlToTranscribe }),
    });

    const rawBody = await deepgramResponse.text();
    console.log(`[transcribe-audio:${reqId}] Deepgram response status:`, deepgramResponse.status);
    console.log(`[transcribe-audio:${reqId}] Deepgram body preview:`, rawBody.substring(0, 400));

    if (!deepgramResponse.ok) {
      throw new Error(`Deepgram API error (${deepgramResponse.status}): ${rawBody.substring(0, 300)}`);
    }

    let parsed: any = {};
    try { parsed = JSON.parse(rawBody); } catch (e) {
      throw new Error(`Deepgram returned non-JSON body: ${String(e)}`);
    }
    const transcript = parsed?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = parsed?.results?.channels?.[0]?.alternatives?.[0]?.confidence;

    console.log(`[transcribe-audio:${reqId}] Deepgram transcript preview:`, transcript.substring(0, 200));
    console.log(`[transcribe-audio:${reqId}] transcript length=${transcript.length} confidence=${confidence}`);

    const isEmpty = transcript.trim().length === 0;
    const finalStatus = isEmpty ? 'failed' : 'completed';

    // 5. Save transcript
    console.log(`[transcribe-audio:${reqId}] Updating voice_posts.transcript for id:`, voicePostId, 'status=', finalStatus);
    const updateResult = await supabase.from('voice_posts').update({
      transcript,
      transcript_status: finalStatus
    }).eq('id', voicePostId).select('id');
    console.log(`[transcribe-audio:${reqId}] Update result:`, { data: updateResult.data, error: updateResult.error });

    // 6. Trigger generate-qa
    if (transcript.trim().length > 30) {
      console.log(`[transcribe-audio:${reqId}] triggering generate-qa`);
      await fetch(`${supabaseUrl}/functions/v1/generate-qa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postId: voicePost.post_id,
          deepContent: transcript
        })
      }).catch(e => console.warn('generate-qa trigger error:', e));
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error(`[transcribe-audio:${reqId}] FATAL:`, error)

    // Attempt retry logic up to 1 times
    try {
      const { voicePostId, retryCount = 0 } = await req.json().catch(() => ({}));
      if (voicePostId && retryCount < 1) {
        console.log(`[transcribe-audio:${reqId}] scheduling retry #1...`);
        // We'll call ourselves asynchronously via fetch
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Wait 3 seconds then fire-and-forget
        setTimeout(() => {
          fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ voicePostId, retryCount: retryCount + 1 })
          }).catch(console.error);
        }, 3000);
      } else if (voicePostId) {
        // Retries exhausted, mark failed
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('voice_posts').update({ transcript_status: 'failed' }).eq('id', voicePostId);
      }
    } catch (e) {
      console.error(`[transcribe-audio:${reqId}] Failed to process retry logic:`, e);
    }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
