import { X } from 'lucide-react';
import { Post } from '@/hooks/usePosts';
import { cn, getDisplayUsername } from '@/lib/utils';
import { MentionText } from './MentionText';
import { MediaGallery } from '@/components/media/MediaGallery';
import { TrustBadge } from '@/components/ui/trust-badge';

interface PostExpandedOverlayProps {
  post: Post;
  onClose: () => void;
}

export const PostExpandedOverlay = ({ post, onClose }: PostExpandedOverlayProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatar = () => {
    const name = post.author.full_name || post.author.username;
    if (post.author.avatar_url) {
      return (
        <img
          src={post.author.avatar_url}
          alt={name}
          className="w-12 h-12 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(name)}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-background z-50 flex flex-col modal-overlay"
      onClick={onClose}
    >
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors"
          aria-label="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold">Post</span>
        <div className="w-10" />
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0">
              {getAvatar()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-lg">
                  {post.author.full_name || getDisplayUsername(post.author.username)}
                </span>
                <span className="text-muted-foreground">
                  @{getDisplayUsername(post.author.username)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-lg leading-relaxed mb-4 whitespace-pre-wrap">
            <MentionText content={post.content} />
          </div>

          {post.media && post.media.length > 0 && (
            <div className="mb-4">
              <MediaGallery media={post.media} />
            </div>
          )}

          {post.shared_url && (
            <div className="border border-border rounded-2xl overflow-hidden mb-4">
              {post.preview_img && (
                <div className="w-full aspect-video bg-muted">
                  <img
                    src={post.preview_img}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-medium mb-2">{post.shared_title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {post.article_content}
                </p>
              </div>
            </div>
          )}

          {post.trust_level && (
            <div className="mb-4">
              <TrustBadge
                band={post.trust_level}
                size="md"
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground border-t border-border pt-4">
            {new Date(post.created_at).toLocaleString('it-IT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
