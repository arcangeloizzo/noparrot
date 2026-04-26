import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CANONICAL = [
  'Società', 'Politica', 'Economia', 'Tecnologia',
  'Scienza', 'Cultura', 'Ambiente', 'Benessere',
] as const;

const MIN_AGGREGATE_LEN = 50;
const SUMMARY_MAX = 3000;
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
    // Auth: accept either service role key (Authorization: Bearer ...) OR internal secret (x-internal-secret)
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
    const target: 'frasi_libere' | 'null' | 'all' = body.target ?? 'all';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Get IDs of posts already processed (any decision) — exclude them v2
    // This avoids re-processing skipped_short / skipped_invalid_ai posts on each batch
    console.log('[reclassify-posts] v2: excluding all processed decisions');
    const { data: doneRows } = await supabase
      .from('reclassification_audit')
      .select('post_id')
      .in('decision', ['reclassified', 'skipped_short', 'skipped_invalid_ai']);
    const excludeIds = new Set<string>((doneRows ?? []).map((r: any) => r.post_id));

    // 2) Build candidate query based on target
    let query = supabase
      .from('posts')
      .select('id, content, title, shared_title, shared_url, hostname, article_content, full_article, transcript, category')
      .or('is_removed.is.null,is_removed.eq.false');

    if (target === 'frasi_libere') {
      query = query.not('category', 'is', null).not('category', 'in', `(${CANONICAL.map(c => `"${c}"`).join(',')})`);
    } else if (target === 'null') {
      query = query.is('category', null);
    } else {
      // 'all' = NULL OR not in canonical
      query = query.or(`category.is.null,and(category.not.in.(${CANONICAL.map(c => `"${c}"`).join(',')}))`);
    }

    // Fetch a larger pool because we may need to filter out already-done IDs
    const { data: allCandidates, error: candErr } = await query.limit(batchSize * 3);
    if (candErr) throw new Error(`Query error: ${candErr.message}`);

    const candidates = (allCandidates ?? [])
      .filter((p: any) => !excludeIds.has(p.id))
      .slice(0, batchSize) as PostRow[];

    const details: any[] = [];
    let reclassified = 0;
    let skippedShort = 0;
    let skippedInvalid = 0;
    let errors = 0;

    for (const post of candidates) {
      try {
        const userContent = trimOr(post.content);
        const titleField = trimOr(post.title);
        const sharedTitle = trimOr(post.shared_title);
        const articleContent = trimOr(post.article_content) || trimOr(post.full_article);
        const transcript = trimOr(post.transcript);
        const mediaText = await fetchMediaTextForPost(supabase, post.id);

        const fields: Record<string, string> = {
          user_content: userContent,
          post_title: titleField,
          shared_title: sharedTitle,
          article_content: articleContent,
          transcript: transcript,
          media_extracted_text: mediaText,
          hostname: trimOr(post.hostname),
        };

        const breakdown: Record<string, number> = Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v.length])
        );

        const aggregate = Object.values(fields).filter(v => v.length > 0).join(' ');

        const normalizedHostname = (post.hostname || '').replace(/^www\./i, '').toLowerCase();
        const knownHost = KNOWN_HOSTS[normalizedHostname];
        const significantLength = aggregate.length - (post.hostname?.length || 0);

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
            decision: 'skipped_short',
          });
          skippedShort++;
          details.push({
            post_id: post.id,
            old: post.category,
            new: null,
            decision: 'skipped_short',
            content_length: aggregate.length,
            significant_length: significantLength,
            host_known: !!knownHost,
            source: Object.entries(breakdown).filter(([, n]) => n > 0).map(([k]) => k).join(' + ') || '<empty>',
          });
          console.log(`Skip-short post ${post.id}: aggregate=${aggregate.length} significant=${significantLength} host_known=${!!knownHost}`);
          continue;
        }

        // Build classify-content payload
        const summaryText = [
          knownHost ? `[Fonte: ${knownHost.hint}]` : null,
          articleContent,
          transcript,
          mediaText,
        ]
          .filter((s): s is string => !!s && s.length > 0)
          .join('\n\n')
          .slice(0, SUMMARY_MAX);

        const classifyPayload = {
          text: userContent || undefined,
          title: sharedTitle || titleField || undefined,
          summary: summaryText || undefined,
        };

        // Call classify-content
        const classifyUrl = `${supabaseUrl}/functions/v1/classify-content`;
        const classifyRes = await fetch(classifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(classifyPayload),
        });

        if (!classifyRes.ok) {
          const errText = await classifyRes.text();
          await supabase.from('reclassification_audit').insert({
            post_id: post.id,
            previous_category: post.category,
            source_snippet: aggregate.slice(0, 500),
            source_breakdown: breakdown,
            decision: 'error',
            error_message: `classify-content HTTP ${classifyRes.status}: ${errText.slice(0, 300)}`,
          });
          errors++;
          details.push({ post_id: post.id, decision: 'error', error: `HTTP ${classifyRes.status}` });
          continue;
        }

        const classifyJson = await classifyRes.json();
        const newCategory: string | null = classifyJson?.category ?? null;

        if (!newCategory || !(CANONICAL as readonly string[]).includes(newCategory)) {
          await supabase.from('reclassification_audit').insert({
            post_id: post.id,
            previous_category: post.category,
            new_category: newCategory,
            source_snippet: aggregate.slice(0, 500),
            source_breakdown: breakdown,
            ai_raw_response: JSON.stringify(classifyJson).slice(0, 1000),
            decision: 'skipped_invalid_ai',
          });
          skippedInvalid++;
          details.push({
            post_id: post.id,
            old: post.category,
            new: newCategory,
            decision: 'skipped_invalid_ai',
            content_length: aggregate.length,
          });
          continue;
        }

        // Apply update unless dry_run
        if (!dryRun) {
          const { error: updErr } = await supabase
            .from('posts')
            .update({
              category: newCategory,
              legacy_category: post.category && !(CANONICAL as readonly string[]).includes(post.category)
                ? post.category
                : undefined,
            })
            .eq('id', post.id);
          if (updErr) {
            await supabase.from('reclassification_audit').insert({
              post_id: post.id,
              previous_category: post.category,
              new_category: newCategory,
              source_snippet: aggregate.slice(0, 500),
              source_breakdown: breakdown,
              ai_raw_response: JSON.stringify(classifyJson).slice(0, 1000),
              decision: 'error',
              error_message: `Update failed: ${updErr.message}`,
            });
            errors++;
            details.push({ post_id: post.id, decision: 'error', error: updErr.message });
            continue;
          }
        }

        await supabase.from('reclassification_audit').insert({
          post_id: post.id,
          previous_category: post.category,
          new_category: newCategory,
          source_snippet: aggregate.slice(0, 500),
          source_breakdown: breakdown,
          ai_raw_response: JSON.stringify(classifyJson).slice(0, 1000),
          decision: 'reclassified',
        });
        reclassified++;
        const sourceLabel = Object.entries(breakdown).filter(([, n]) => n > 0).map(([k]) => k).join(' + ');
        details.push({
          post_id: post.id,
          old: post.category,
          new: newCategory,
          decision: 'reclassified',
          content_length: aggregate.length,
          source: sourceLabel,
        });

        await new Promise(r => setTimeout(r, THROTTLE_MS));
      } catch (e) {
        errors++;
        const msg = (e as Error).message || 'unknown';
        await supabase.from('reclassification_audit').insert({
          post_id: post.id,
          previous_category: post.category,
          decision: 'error',
          error_message: msg.slice(0, 500),
        });
        details.push({ post_id: post.id, decision: 'error', error: msg });
      }
    }

    // Cascade comments.post_category sync (only if any reclassification happened)
    if (!dryRun && reclassified > 0) {
      const updatedIds = details.filter(d => d.decision === 'reclassified').map(d => d.post_id);
      // Best-effort: re-fetch new categories for these posts and sync comments
      const { data: updatedPosts } = await supabase
        .from('posts')
        .select('id, category')
        .in('id', updatedIds);
      for (const p of updatedPosts ?? []) {
        await supabase
          .from('comments')
          .update({ post_category: (p as any).category })
          .eq('post_id', (p as any).id);
      }
    }

    return new Response(
      JSON.stringify({
        total_candidates: candidates.length,
        reclassified,
        skipped_short: skippedShort,
        skipped_invalid_ai: skippedInvalid,
        errors,
        dry_run: dryRun,
        duration_ms: Date.now() - startTime,
        details,
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('reclassify-posts fatal error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});