import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { useSavedPosts } from "@/hooks/usePosts";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Image as ImageIcon, Link2, FileText } from "lucide-react";
import type { Post } from "@/hooks/usePosts";

const SavedPostThumbnail = ({ post }: { post: Post }) => {
  const navigate = useNavigate();

  // Determine background image
  const getBackgroundImage = (): string | null => {
    // First check media
    if (post.media && post.media.length > 0) {
      const firstMedia = post.media[0];
      return firstMedia.thumbnail_url || firstMedia.url;
    }
    // Then check preview image (for links)
    if (post.preview_img) {
      return post.preview_img;
    }
    return null;
  };

  // Determine content type icon
  const getContentIcon = () => {
    if (post.media && post.media.length > 0) {
      const firstMedia = post.media[0];
      if (firstMedia.type === 'video') {
        return <Play className="w-3 h-3 fill-white" />;
      }
      return <ImageIcon className="w-3 h-3" />;
    }
    if (post.shared_url) {
      return <Link2 className="w-3 h-3" />;
    }
    return <FileText className="w-3 h-3" />;
  };

  const backgroundImage = getBackgroundImage();
  const displayText = post.shared_title || post.content;
  const authorInitials = post.author?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div
      onClick={() => navigate(`/post/${post.id}`)}
      className="aspect-[4/5] relative overflow-hidden bg-muted cursor-pointer group"
    >
      {/* Background */}
      {backgroundImage ? (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F3347] to-[#0E141A] flex items-center justify-center">
          <span className="text-3xl font-bold text-white/20">{authorInitials}</span>
        </div>
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Content type icon - top right */}
      <div className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white">
        {getContentIcon()}
      </div>

      {/* Content overlay - bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-white text-xs font-medium line-clamp-2 leading-tight mb-1.5">
          {displayText}
        </p>
        <div className="flex items-center gap-1.5">
          <Avatar className="w-4 h-4 border border-white/20">
            <AvatarImage src={post.author?.avatar_url || undefined} />
            <AvatarFallback className="text-[8px] bg-white/10 text-white">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-white/70 text-[10px] truncate">
            {post.author?.full_name || post.author?.username || 'Utente'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const Saved = () => {
  const navigate = useNavigate();
  const { data: savedPosts = [], isLoading } = useSavedPosts();
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
    else if (tab === 'notifications') navigate('/notifications');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/30">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-foreground" />
            </button>
            <div className="p-2 bg-brand-pink/10 rounded-xl">
              <BookmarkIcon className="w-6 h-6 text-brand-pink" filled />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Salvati</h1>
              {savedPosts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {savedPosts.length} {savedPosts.length === 1 ? 'post' : 'post'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-2 border-brand-pink/30 border-t-brand-pink rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Caricamento salvati...</p>
        </div>
      ) : savedPosts.length > 0 ? (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {savedPosts.map((post, index) => (
            <div 
              key={post.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <SavedPostThumbnail post={post} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <div className="w-20 h-20 bg-brand-pink/10 rounded-3xl flex items-center justify-center mb-4">
            <BookmarkIcon className="w-10 h-10 text-brand-pink/50" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Nessun post salvato
          </h2>
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            Inizia a salvare i post che ti interessano per trovarli facilmente qui
          </p>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab="saved"
        onTabChange={handleTabChange}
        onProfileClick={() => setShowProfileSheet(true)}
      />
      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />
    </div>
  );
};