import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { useSavedPosts } from "@/hooks/usePosts";
import { useSavedFocus } from "@/hooks/useFocusBookmarks";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Image as ImageIcon, Link2, FileText, Newspaper, Music, Video, Globe, Linkedin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Post } from "@/hooks/usePosts";
import type { DailyFocus } from "@/hooks/useDailyFocus";

// Detect platform from URL
const detectPlatform = (url: string | null): 'spotify' | 'youtube' | 'linkedin' | 'twitter' | 'tiktok' | 'article' | 'text' => {
  if (!url) return 'text';
  const lower = url.toLowerCase();
  if (lower.includes('spotify.com') || lower.includes('open.spotify')) return 'spotify';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('tiktok.com')) return 'tiktok';
  return 'article';
};

// Platform-specific fallback design
const PlatformFallback = ({ platform }: { platform: ReturnType<typeof detectPlatform> }) => {
  const configs = {
    spotify: {
      gradient: 'from-[#1DB954] via-[#1DB954]/80 to-[#191414]',
      icon: Music,
      iconColor: 'text-white',
    },
    youtube: {
      gradient: 'from-[#FF0000] via-[#FF0000]/80 to-[#282828]',
      icon: Play,
      iconColor: 'text-white',
    },
    linkedin: {
      gradient: 'from-[#0A66C2] via-[#0A66C2]/80 to-[#0D1B2A]',
      icon: Linkedin,
      iconColor: 'text-white',
    },
    twitter: {
      gradient: 'from-[#1DA1F2] via-[#1DA1F2]/80 to-[#14171A]',
      icon: Globe,
      iconColor: 'text-white',
    },
    tiktok: {
      gradient: 'from-[#FF0050] via-[#00F2EA]/60 to-[#000000]',
      icon: Video,
      iconColor: 'text-white',
    },
    article: {
      gradient: 'from-[#3B82F6] via-[#3B82F6]/70 to-[#1E3A5F]',
      icon: Newspaper,
      iconColor: 'text-white',
    },
    text: {
      gradient: 'from-[#1F3347] via-[#1F3347]/90 to-[#0E141A]',
      icon: FileText,
      iconColor: 'text-white/60',
    },
  };

  const config = configs[platform];
  const Icon = config.icon;

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
      <Icon className={`w-10 h-10 ${config.iconColor} opacity-40`} />
    </div>
  );
};

const SavedPostThumbnail = ({ post }: { post: Post }) => {
  const navigate = useNavigate();

  // Determine background image - prioritize content images
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
  const platform = detectPlatform(post.shared_url);
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
        <PlatformFallback platform={platform} />
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

// Saved Editorial Thumbnail component
const SavedEditorialThumbnail = ({ focus, onClick }: { focus: DailyFocus; onClick: () => void }) => {
  const displayTitle = focus.title || 'Il Punto';

  return (
    <div
      onClick={onClick}
      className="aspect-[4/5] relative overflow-hidden bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#0E141A] cursor-pointer group"
    >
      {/* Background image if available */}
      {focus.image_url && (
        <img
          src={focus.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40 transition-transform duration-300 group-hover:scale-105"
        />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* IL PUNTO badge - top left */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-white/10 backdrop-blur-sm rounded-full">
        <span className="text-[10px] font-bold tracking-wider text-white uppercase">IL PUNTO</span>
      </div>

      {/* Content type icon - top right */}
      <div className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white">
        <Newspaper className="w-3 h-3" />
      </div>

      {/* Content overlay - bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-white text-xs font-semibold line-clamp-3 leading-tight mb-1.5">
          {displayTitle}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-white/50 text-[10px]">
            {focus.edition_time || 'editoriale'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const Saved = () => {
  const navigate = useNavigate();
  const { data: savedPosts = [], isLoading: isLoadingPosts } = useSavedPosts();
  const { data: savedFocus = [], isLoading: isLoadingFocus } = useSavedFocus();
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'editorials'>('posts');

  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
    else if (tab === 'notifications') navigate('/notifications');
  };

  const totalCount = savedPosts.length + savedFocus.length;
  const isLoading = isLoadingPosts || isLoadingFocus;

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
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalCount} {totalCount === 1 ? 'elemento' : 'elementi'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {(savedPosts.length > 0 || savedFocus.length > 0) && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'posts' | 'editorials')} className="px-4 pb-2">
            <TabsList className="w-full grid grid-cols-2 h-9">
              <TabsTrigger value="posts" className="text-xs">
                Post {savedPosts.length > 0 && `(${savedPosts.length})`}
              </TabsTrigger>
              <TabsTrigger value="editorials" className="text-xs">
                Il Punto {savedFocus.length > 0 && `(${savedFocus.length})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-2 border-brand-pink/30 border-t-brand-pink rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Caricamento salvati...</p>
        </div>
      ) : totalCount > 0 ? (
        <>
          {/* Posts Tab */}
          {activeTab === 'posts' && (
            savedPosts.length > 0 ? (
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
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <p className="text-muted-foreground text-sm text-center">
                  Nessun post salvato. Salva i post dal feed per trovarli qui.
                </p>
              </div>
            )
          )}

          {/* Editorials Tab */}
          {activeTab === 'editorials' && (
            savedFocus.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {savedFocus.map((focus, index) => (
                  <div 
                    key={focus.id} 
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <SavedEditorialThumbnail 
                      focus={focus} 
                      onClick={() => navigate(`/?focus=${focus.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <p className="text-muted-foreground text-sm text-center">
                  Nessun editoriale salvato. Salva gli articoli "Il Punto" dal carousel.
                </p>
              </div>
            )
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <div className="w-20 h-20 bg-brand-pink/10 rounded-3xl flex items-center justify-center mb-4">
            <BookmarkIcon className="w-10 h-10 text-brand-pink/50" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Nessun contenuto salvato
          </h2>
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            Inizia a salvare post ed editoriali per trovarli facilmente qui
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