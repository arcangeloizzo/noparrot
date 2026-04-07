import { ExternalLink } from "lucide-react";
import type { Post } from "@/hooks/usePosts";

interface LinkedInCardProps {
  post: Post;
  articlePreview: any;
  useStackLayout: boolean;
}

export const LinkedInCard = ({
  post,
  articlePreview,
  useStackLayout,
}: LinkedInCardProps) => {
  return (
    <div className="w-full mt-2 sm:mt-6 flex-shrink min-h-0 flex flex-col justify-center">
      {/* Unified LinkedIn Card */}
      <div
        className="bg-gradient-to-br from-[#0A66C2]/10 to-white/90 dark:from-[#0A66C2]/20 dark:to-[#1a1a2e]/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-black/5 dark:border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.1),_0_0_16px_rgba(10,102,194,0.1)] dark:shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(10,102,194,0.15)] cursor-pointer active:scale-[0.98] transition-transform max-h-full flex flex-col"
        onClick={(e) => {
          e.stopPropagation();
          if (post.shared_url) {
            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
          }
        }}
      >
        {/* Author Row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#0A66C2]/20 flex-shrink-0 flex items-center justify-center">
            {articlePreview?.author_avatar ? (
              <img
                src={articlePreview.author_avatar}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-white/70 text-xl font-bold">
                {(() => {
                  // Get first letter of author name
                  const author = articlePreview?.author ||
                    (articlePreview?.title || '')
                      .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
                      .replace(/^Post di\s+/i, '')
                      .replace(/^Post by\s+/i, '')
                      .split(/\s*[|\-–]\s*/)[0]
                      .trim();
                  return (author || 'L').charAt(0).toUpperCase();
                })()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">
              {articlePreview?.author ||
                (articlePreview?.title || '')
                  .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
                  .replace(/^Post di\s+/i, '')
                  .replace(/^Post by\s+/i, '')
                  .split(/\s*[|\-–]\s*/)[0]
                  .trim() ||
                'LinkedIn User'}
            </p>
            <p className="text-white/50 text-sm">su LinkedIn</p>
          </div>
        </div>

        {/* Post Text - cleaned and clamped */}
        <p className="text-white text-base leading-relaxed mb-2 sm:mb-4 line-clamp-4">
          {(articlePreview?.content || articlePreview?.description || articlePreview?.summary || '')
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim() ||
            (articlePreview?.title || '')
              .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
              .replace(/^Post di\s+/i, '')
              .replace(/^Post by\s+/i, '')
              .trim()}
        </p>

        {/* Post Image (if any) */}
        {(articlePreview?.image || post.preview_img) && (
          <div className="rounded-xl overflow-hidden flex-shrink min-h-0">
            <img
              src={articlePreview?.image || post.preview_img}
              alt=""
              className={useStackLayout ? "w-full h-auto max-h-24 sm:max-h-40 object-cover" : "w-full h-auto object-cover rounded-xl"}
            />
          </div>
        )}
      </div>

      {/* Open on LinkedIn CTA - Below the card */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (post.shared_url) {
            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
          }
        }}
        className="mt-3 inline-flex self-start items-center gap-2 text-white/50 hover:text-white transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span className="text-xs uppercase tracking-wider">Apri su LinkedIn</span>
      </button>
    </div>
  );
};
