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
 * Safe URL normalization for cache/whitelist lookup.
 * - Forces https://
 * - Removes www. from hostname only
 * - Lowercase hostname only (preserves path case)
 * - Removes ONLY known tracking params
 * - Sorts remaining query params alphabetically
 */
// Only tracking params we agreed to remove:
// - All utm_* variants
// - Platform click IDs (7 total)
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid',    // Facebook
  'gclid',     // Google Ads
  'dclid',     // DoubleClick
  'msclkid',   // Microsoft Ads
  'igshid',    // Instagram
  'twclid',    // Twitter
  'ttclid'     // TikTok
]);

export function safeNormalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    
    // Force https
    url.protocol = 'https:';
    
    // Remove www. from hostname, lowercase hostname only
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    
    // Remove hash
    url.hash = '';
    
    // Remove trailing slash from pathname (but preserve rest of path case)
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    
    // Filter out tracking params, keep functional ones
    const cleanParams = new URLSearchParams();
    const entries = Array.from(url.searchParams.entries())
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        // Remove any utm_* param (covers all variants)
        if (lowerKey.startsWith('utm_')) return false;
        // Remove known click IDs
        return !TRACKING_PARAMS.has(lowerKey);
      })
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [key, value] of entries) {
      cleanParams.set(key, value);
    }
    
    url.search = cleanParams.toString();
    
    return url.toString();
  } catch {
    // If URL parsing fails, return trimmed only (NO toLowerCase on full URL)
    return rawUrl.trim();
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
