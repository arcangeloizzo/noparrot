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

    console.log(`[transcribe-audio:${reqId}] processing voicePostId=${voicePostId} retry=${retryCount}`)

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

    const audioUrlToTranscribe = signErr ? `${supabaseUrl}/storage/v1/object/public/voice-audio/${voicePost.audio_url}` : signedUrlData.signedUrl;

    console.log(`[transcribe-audio:${reqId}] triggering deepgram`);

    // 4. Call Deepgram
    const deepgramResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=it&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: audioUrlToTranscribe }),
    });

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text()
      throw new Error(`Deepgram API error (${deepgramResponse.status}): ${errText}`);
    }

    const { results } = await deepgramResponse.json();
    const transcript = results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    console.log(`[transcribe-audio:${reqId}] transcript obtained length=${transcript.length}`);

    if (transcript.trim().length === 0) {
      console.warn(`[transcribe-audio:${reqId}] empty transcript returned`);
      // Treat empty response as valid completion if we got one
    }

    // 5. Save transcript
    await supabase.from('voice_posts').update({
      transcript,
      transcript_status: 'completed'
    }).eq('id', voicePostId);

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
