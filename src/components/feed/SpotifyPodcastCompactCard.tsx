import { useDominantColors } from "@/hooks/useDominantColors";
import { cn } from "@/lib/utils";

interface SpotifyPodcastCompactCardProps {
  imageUrl: string;
  podcastName: string;
  episodeTitle: string;
  spotifyUrl: string;
  className?: string;
}

/**
 * SpotifyPodcastCompactCard
 * 
 * Compact card for podcast episodes shared via Spotify.
 * Shows cover art, podcast name, episode title, and "Ascolta su Spotify" button.
 * Used in Mic's editorial posts where the body text is the primary content
 * and the Spotify link is an enhancement, not the payload.
 */
export const SpotifyPodcastCompactCard = ({
  imageUrl,
  podcastName,
  episodeTitle,
  spotifyUrl,
  className,
}: SpotifyPodcastCompactCardProps) => {
  const { primary, secondary } = useDominantColors(imageUrl);

  const gradientBg = imageUrl
    ? `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`
    : 'linear-gradient(135deg, #1a1a2e 0%, #0d1117 100%)';

  return (
    <a
      href={spotifyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block w-full rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform no-underline",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex flex-row items-center gap-3 p-3"
        style={{ background: gradientBg, minHeight: '120px' }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Cover art */}
        <div className="relative z-10 w-[88px] h-[88px] rounded-lg overflow-hidden flex-shrink-0 shadow-lg border border-white/10">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={podcastName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-between py-0.5" style={{ minHeight: '88px' }}>
          {/* Podcast name */}
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider truncate">
            {podcastName}
          </p>

          {/* Episode title */}
          <p className="text-sm font-medium text-white leading-tight line-clamp-2 my-1">
            {episodeTitle}
          </p>

          {/* CTA button */}
          <div className="flex items-center gap-1.5 bg-[#1DB954] px-3 py-1.5 rounded-full self-start mt-auto">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <span className="text-white text-xs font-bold">Ascolta su Spotify</span>
          </div>
        </div>
      </div>
    </a>
  );
};
