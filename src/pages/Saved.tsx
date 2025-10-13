import { useState } from "react";
import { BookmarkIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useSavedPosts } from "@/hooks/usePosts";
import { FeedCard } from "@/components/feed/FeedCardAdapt";

export const Saved = () => {
  const { data: savedPosts = [], isLoading } = useSavedPosts();


  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <BookmarkIcon className="w-6 h-6 text-primary" filled />
              <h1 className="text-xl font-semibold text-foreground">Salvati</h1>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-muted-foreground">Caricamento...</div>
          </div>
        ) : savedPosts.length > 0 ? (
          <div className="divide-y divide-border">
            {savedPosts.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <BookmarkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Nessun post salvato</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Inizia a salvare i post che ti interessano per trovarli facilmente qui
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};