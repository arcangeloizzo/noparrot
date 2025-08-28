import { useState, useMemo } from "react";
import { BookmarkIcon, GridIcon, ListIcon } from "@/components/ui/icons";
import { mockPosts } from "@/data/mockData";
import { cn } from "@/lib/utils";

export const Saved = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter only bookmarked posts
  const savedPosts = useMemo(() => 
    mockPosts.filter(post => post.isBookmarked)
  , []);

  const GridView = () => (
    <div className="grid grid-cols-3 gap-1 p-4">
      {savedPosts.map((post) => (
        <div
          key={post.id}
          className="aspect-square bg-muted rounded-lg overflow-hidden relative group cursor-pointer"
        >
          {post.previewImg ? (
            <img
              src={post.previewImg}
              alt={post.sharedTitle || "Saved post"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-blue/10 to-accent/20 flex items-center justify-center p-2">
              <p className="text-xs font-medium text-center text-foreground line-clamp-4">
                {post.userComment}
              </p>
            </div>
          )}
          
          {/* Overlay with interaction hint */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <BookmarkIcon className="w-6 h-6 text-white" filled />
          </div>
        </div>
      ))}
    </div>
  );

  const ListView = () => (
    <div className="p-4 space-y-3">
      {savedPosts.map((post) => (
        <div
          key={post.id}
          className="bg-card rounded-lg border border-border/50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex space-x-3">
            {/* User Info */}
            <div className="w-8 h-8 rounded-full bg-primary-blue flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {post.authorName.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-medium text-sm text-foreground">{post.authorName}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{post.minutesAgo}m</span>
              </div>
              
              <p className="text-sm text-foreground line-clamp-2 mb-2">
                {post.userComment}
              </p>
              
              {post.sharedTitle && (
                <p className="text-sm font-medium text-primary-blue line-clamp-1">
                  {post.sharedTitle}
                </p>
              )}
            </div>
            
            {post.previewImg && (
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={post.previewImg}
                  alt={post.sharedTitle || "Post image"}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BookmarkIcon className="w-6 h-6 text-primary-blue" filled />
                <h1 className="text-xl font-semibold text-foreground">Salvati</h1>
              </div>
              
              <div className="flex space-x-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-primary-blue text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GridIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-primary-blue text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {savedPosts.length > 0 ? (
          <>
            <div className="p-4 border-b border-border/50">
              <p className="text-sm text-muted-foreground">
                {savedPosts.length} post salvati
              </p>
            </div>
            
            {viewMode === "grid" ? <GridView /> : <ListView />}
          </>
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