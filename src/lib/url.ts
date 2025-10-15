/**
 * Normalizza un URL per il confronto (rimuove hash, query params, trailing slash)
 */
export function normalizeUrl(u?: string): string {
  try {
    const url = new URL(String(u || '').trim());
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().toLowerCase();
  } catch {
    return String(u || '').trim().toLowerCase();
  }
}

/**
 * Unisce e deduplica array di fonti (URL)
 */
export function uniqueSources(original: string[] = [], added: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  
  for (const s of [...original, ...added].filter(Boolean)) {
    const n = normalizeUrl(s);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(s);
    }
  }
  
  return out;
}
