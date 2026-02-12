export const detectPlatformFromUrl = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('tiktok')) return 'tiktok';
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('threads')) return 'threads';
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('spotify')) return 'spotify';
    if (hostname.includes('instagram')) return 'instagram';
    if (hostname.includes('facebook') || hostname.includes('fb.com') || hostname.includes('fb.watch')) return 'facebook';
    return undefined;
  } catch {
    return undefined;
  }
};
