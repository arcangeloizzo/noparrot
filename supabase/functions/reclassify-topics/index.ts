import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_AGGREGATE_LEN = 50;
const THROTTLE_MS = 200;

const KNOWN_HOSTS: Record<string, { hint: string }> = {
  'open.spotify.com': { hint: 'contenuto musicale o podcast su Spotify' },
  'spotify.com': { hint: 'contenuto musicale o podcast su Spotify' },
  'youtube.com': { hint: 'video YouTube' },
  'youtu.be': { hint: 'video YouTube' },
  'music.youtube.com': { hint: 'contenuto musicale YouTube' },
  'genius.com': { hint: 'testi musicali' },
  'wired.it': { hint: 'articolo Wired (tech/scienza/cultura)' },
  'wired.com': { hint: 'articolo Wired (tech/scienza/cultura)' },
  'ilpost.it': { hint: 'articolo de Il Post' },
  'corriere.it': { hint: 'articolo Corriere della Sera' },
  'repubblica.it': { hint: 'articolo La Repubblica' },
  'ansa.it': { hint: 'notizia ANSA' },
  'reuters.com': { hint: 'notizia Reuters' },
  'theguardian.com': { hint: 'articolo The Guardian' },
  'nytimes.com': { hint: 'articolo New York Times' },
  'lefigaro.fr': { hint: 'articolo Le Figaro' },
  'internazionale.it': { hint: 'articolo Internazionale' },
  'valigiablu.it': { hint: 'articolo Valigia Blu' },
  'substack.com': { hint: 'newsletter Substack' },
  'medium.com': { hint: 'articolo Medium' },
};

interface PostRow {
  id: string;
  content: string | null;
  title: string | null;
  shared_title: string | null;
  shared_url: string | null;
  hostname: string | null;
  article_content: string | null;
  full_article: string | null;
  transcript: string | null;
  category: string | null;
}

function trimOr(v: string | null | undefined): string {
  return (v ?? '').trim();
}

async function fetchMediaTextForPost(supabase: any, postId: string): Promise<string> {
  const { data, error } = await supabase
    .from('post_media')
    .select('media:media_id (extracted_text, extracted_status)')
    .eq('post_id', postId);
  if (error || !data) return '';
  const parts: string[] = [];
  for (const row of data) {
    const m = (row as any).media;
    if (m && typeof m.extracted_text === 'string' && m.extracted_text.trim().length > 0) {
      parts.push(m.extracted_text.trim());
    }
  }
  return parts.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const internalSecret = Deno.env.get('PUSH_INTERNAL_SECRET') ?? '';
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const xInternal = req.headers.get('x-internal-secret') || '';
    const okBearer = bearer.length > 0 && bearer === serviceRoleKey;
    const okInternal = internalSecret.length > 0 && xInternal === internalSecret;
    if (!okBearer && !okInternal) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: requires service role key or internal secret' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const batchSize: number = Math.max(1, Math.min(100, body.batch_size ?? 10));
    const dryRun: boolean = body.dry_run === true;
    const target: 'missing' | 'all' = body.target ?? 'missing';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Build candidates: posts NOT in post_topics (target='missing') OR all posts (target='all')
    let excludeIds = new Set<string>();

    if (target === 'missing') {
      const { data: existing } = await supabase
        .from('post_topics')
        .select('post_id');
      excludeIds = new Set<string>((existing ?? []).map((r: any) => r.post_id));
    }

    // Also exclude posts already audited as topic_skipped/topic_error to avoid retry loops
    const { data: doneRows } = await supabase
      .from('reclassification_audit')
      .select('post_id')
      .in('decision', ['topic_assigned', 'topic_skipped']);
    for (const r of (doneRows ?? [])) {
      excludeIds.add((r as any).post_id);
    }

    const { data: allCandidates, error: candErr } = await supabase
      .from('posts')
      .select('id, content, title, shared_title, shared_url, hostname, article_content, full_article, transcript, category')
      .or('is_removed.is.null,is_removed.eq.false')
      .limit(batchSize * 4);

    if (candErr) throw new Error(`Query error: ${candErr.message}`);

    const candidates = (allCandidates ?? [])
      .filter((p: any) => !excludeIds.has(p.id))
      .slice(0, batchSize) as PostRow[];

    const details: any[] = [];
    let topicAssigned = 0;
    let topicSkipped = 0;
    let topicError = 0;

    for (const post of candidates) {
      try {
        const userContent = trimOr(post.content);
        const titleField = trimOr(post.title);
        const sharedTitle = trimOr(post.shared_title);
        const articleContent = trimOr(post.article_content) || trimOr(post.full_article);
        const transcript = trimOr(post.transcript);
        const mediaText = await fetchMediaTextForPost(supabase, post.id);
        const hostname = trimOr(post.hostname);

        const fields: Record<string, string> = {
          user_content: userContent,
          post_title: titleField,
          shared_title: sharedTitle,
          article_content: articleContent,
          transcript,
          media_extracted_text: mediaText,
          hostname,
        };

        const breakdown: Record<string, number> = Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v.length])
        );

        const aggregate = Object.values(fields).filter(v => v.length > 0).join(' ');
        const normalizedHostname = hostname.replace(/^www\./i, '').toLowerCase();
        const knownHost = KNOWN_HOSTS[normalizedHostname];
        const significantLength = aggregate.length - hostname.length;

        const shouldSkipShort = (!knownHost && significantLength < MIN_AGGREGATE_LEN)
          || (knownHost && significantLength < 10);

        breakdown.host_known = knownHost ? 1 : 0;
        breakdown.significant_length = significantLength;

        if (shouldSkipShort) {
          await supabase.from('reclassification_audit').insert({
            post_id: post.id,
            previous_category: post.category,
            new_category: null,
            source_snippet: aggregate.slice(0, 500),
            source_breakdown: breakdown,
            decision: 'topic_skipped',
          });
          topicSkipped++;
          details.push({
            post_id: post.id,
            decision: 'topic_skipped',
            content_length: aggregate.length,
            significant_length: significantLength,
            host_known: !!knownHost,
          });
          continue;
        }

        if (dryRun) {
          details.push({
            post_id: post.id,
            decision: 'dry_run',
            content_length: aggregate.length,
            host_known: !!knownHost,
          });
          continue;
        }

        // Call assign-post-topic — it does its own aggregation + AI + upsert
        const url = `${supabaseUrl}/functions/v1/assign-post-topic`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ post_id: post.id }),
        });

        if (!res.ok) {
          const errText = await res.text();
          await supabase.from('reclassification_audit').insert({
            post_id: post.id,
            previous_category: post.category,
            source_snippet: aggregate.slice(0, 500),
            source_breakdown: breakdown,
            decision: 'topic_error',
            error_message: `assign-post-topic HTTP ${res.status}: ${errText.slice(0, 300)}`,
          });
          topicError++;
          details.push({ post_id: post.id, decision: 'topic_error', error: `HTTP ${res.status}` });
          continue;
        }

        const result = await res.json();

        if (result.skipped) {
          await supabase.from('reclassification_audit').insert({
            post_id: post.id,
            previous_category: post.category,
            source_snippet: aggregate.slice(0, 500),
            source_breakdown: breakdown,
            ai_raw_response: JSON.stringify(result).slice(0, 1000),
            decision: 'topic_skipped',
          });
          topicSkipped++;
          details.push({
            post_id: post.id,
            decision: 'topic_skipped',
            reason: result.reason,
          });
          continue;
        }

        await supabase.from('reclassification_audit').insert({
          post_id: post.id,
          previous_category: post.category,
          new_category: result.macro_category,
          source_snippet: aggregate.slice(0, 500),
          source_breakdown: breakdown,
          ai_raw_response: JSON.stringify(result).slice(0, 1000),
          decision: 'topic_assigned',
        });
        topicAssigned++;
        details.push({
          post_id: post.id,
          decision: 'topic_assigned',
          topic_id: result.topic_id,
          topic_label: result.topic_label,
          macro_category: result.macro_category,
          confidence: result.confidence,
          post_macro: post.category,
        });

        await new Promise(r => setTimeout(r, THROTTLE_MS));
      } catch (e) {
        topicError++;
        const msg = (e as Error).message || 'unknown';
        await supabase.from('reclassification_audit').insert({
          post_id: post.id,
          previous_category: post.category,
          decision: 'topic_error',
          error_message: msg.slice(0, 500),
        });
        details.push({ post_id: post.id, decision: 'topic_error', error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        target,
        total_candidates: candidates.length,
        topic_assigned: topicAssigned,
        topic_skipped: topicSkipped,
        topic_error: topicError,
        dry_run: dryRun,
        duration_ms: Date.now() - startTime,
        details,
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('reclassify-topics fatal error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});