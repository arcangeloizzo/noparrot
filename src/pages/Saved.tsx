import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useSavedPosts } from "@/hooks/usePosts";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";

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
      <div className="mobile-container">
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
          <div className="py-2 space-y-1.5 px-2">
            {savedPosts.map((post, index) => (
              <div 
                key={post.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <FeedCard post={post} />
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
      </div>

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
