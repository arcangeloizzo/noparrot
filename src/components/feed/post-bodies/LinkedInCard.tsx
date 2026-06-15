import { Linkedin } from "lucide-react";
import type { Post } from "@/hooks/usePosts";
import { cn } from "@/lib/utils";

interface LinkedInCardProps {
  post: Post;
  articlePreview: any;
  useStackLayout?: boolean;
  embedStep?: 'full' | 'compact' | 'pill';
}

export const LinkedInCard = ({
  post,
  articlePreview,
  useStackLayout,
  embedStep = 'full',
}: LinkedInCardProps) => {
  
  if (embedStep === 'pill') {
    return (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (post.shared_url) {
            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
          }
        }}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/30 hover:bg-[#0A66C2]/20 transition-colors text-left"
        style={{ height: 50 }}
      >
        <div className="w-8 h-8 rounded-full bg-[#0A66C2]/20 flex-shrink-0 flex items-center justify-center">
          <span className="text-[#0A66C2] text-sm font-bold">in</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/60 uppercase tracking-wider">Articolo su LinkedIn</p>
          <p className="text-sm text-white truncate">{articlePreview?.title || post.shared_title}</p>
        </div>
      </button>
    );
  }

  // Author row setup
  const authorInit = (() => {
    const author = articlePreview?.author ||
      (articlePreview?.title || '')
        .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
        .replace(/^Post di\s+/i, '')
        .replace(/^Post by\s+/i, '')
        .split(/\s*[|\-–]\s*/)[0]
        .trim();
    return (author || 'I').charAt(0).toUpperCase();
  })();

  const authorName = articlePreview?.author ||
    (articlePreview?.title || '')
      .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
      .replace(/^Post di\s+/i, '')
      .replace(/^Post by\s+/i, '')
      .split(/\s*[|\-–]\s*/)[0]
      .trim() ||
    'LinkedIn User';

  const bodyText = (articlePreview?.content || articlePreview?.description || articlePreview?.summary || '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() ||
    (articlePreview?.title || '')
      .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
      .replace(/^Post di\s+/i, '')
      .replace(/^Post by\s+/i, '')
      .trim();

  // Full or compact rendering
  return (
    <div 
      className={cn(
        "rounded-2xl p-3 flex flex-col gap-2 transition-colors",
        embedStep === 'compact' 
          ? "bg-[#0A66C2]/5 border border-[#0A66C2]/20 opacity-90" 
          : "bg-gradient-to-br from-[#0A66C2]/10 to-white/90 dark:from-[#0A66C2]/20 dark:to-[#1a1a2e]/95 border border-black/5 dark:border-white/15"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#0A66C2]/20 border border-white/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {articlePreview?.author_avatar ? (
            <img
              src={articlePreview.author_avatar}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-[#0A66C2] text-sm font-bold">{authorInit}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {authorName}
          </p>
          <p className="text-xs text-white/50">su LinkedIn</p>
        </div>
      </div>

      {/* Body text */}
      {bodyText && (
        <p 
          className={cn(
            "text-sm text-white/85 leading-relaxed",
            embedStep === 'compact' ? "line-clamp-2" : "line-clamp-4"
          )}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {bodyText}
        </p>
      )}

      {/* Image: only in full state, horizontal wide cropped */}
      {embedStep === 'full' && (articlePreview?.image || post.preview_img) && (
        <div className="rounded-lg overflow-hidden flex-shrink min-h-0">
          <img
            src={articlePreview?.image || post.preview_img}
            alt=""
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            className="w-full"
            style={{
              height: 150,
              objectFit: 'cover',
              objectPosition: 'center'
            }}
          />
        </div>
      )}
    </div>
  );
};
