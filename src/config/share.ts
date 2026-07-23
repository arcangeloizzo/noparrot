/**
 * Base URL for the public share/OG function.
 *
 * Today: points directly to the Supabase edge function so crawlers get proper
 * text/html OG meta (verified via GET curl with real UAs — the platform serves
 * the function's declared Content-Type end-to-end).
 *
 * TODO: when the Cloudflare/edge proxy on `noparrot.app/s` is live, change to
 *   `https://noparrot.app/s`
 * so shared links carry the branded domain in previews.
 */
/**
 * Cloudflare Worker route on `share.noparrot.app/s/*` proxies to the
 * Supabase share edge function and serves crawlers proper text/html OG.
 */
export const SHARE_BASE = 'https://share.noparrot.app/s';

export type ShareType = 'post' | 'profile' | 'challenge' | 'il_punto';

/**
 * Build the canonical share URL for a given entity.
 * Prefers a human-readable identifier (post slug, profile username) when provided;
 * falls back to the UUID id otherwise. Shared links are permanent — the slug
 * assigned to a post at creation is what should be embedded here.
 */
export const buildShareUrl = (
  type: ShareType,
  id: string,
  slug?: string | null,
): string => {
  const identifier = slug && slug.trim() ? slug.trim() : id;
  return `${SHARE_BASE}/${type}/${encodeURIComponent(identifier)}`;
};