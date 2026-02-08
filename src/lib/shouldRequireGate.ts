/**
 * Utility per rilevare URL nei testi e determinare se serve il Gate
 */

export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

export function shouldRequireGate(text: string): boolean {
  return extractFirstUrl(text) !== null;
}
