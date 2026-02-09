import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FeedCard } from "./FeedCardAdapt";
import { Post, usePosts } from "@/hooks/usePosts";

interface SimilarContentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  originalPost: Post;
}

export const SimilarContentOverlay = ({ isOpen, onClose, originalPost }: SimilarContentOverlayProps) => {
  const { data: allPosts = [] } = usePosts();
  const [showUnverifiedSources, setShowUnverifiedSources] = useState(false);

  if (!isOpen) return null;

  // Generate similar posts from database
  const similarPosts = allPosts
    .filter(post => post.id !== originalPost.id && post.topic_tag === originalPost.topic_tag)
    .slice(0, 6);

  const filteredPosts = showUnverifiedSources
    ? similarPosts
    : similarPosts.filter(post => post.sources.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Backdrop blur */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={onClose} />

      {/* Overlay content */}
      <div className="bg-light-gray rounded-3xl w-[90vw] h-[84vh] relative overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-light-gray/95 backdrop-blur-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-blue">
              Contenuti simili
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-dark-blue"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-blue/70">
              Fonti non attive
            </span>
            <Switch
              checked={showUnverifiedSources}
              onCheckedChange={setShowUnverifiedSources}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-full pb-20">
          <div className="space-y-3">
            {filteredPosts.map((post, index) => (
              <div
                key={post.id}
                className="mb-4"
              >
                <FeedCard
                  post={post}
                />
              </div>
            ))}

            {filteredPosts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-dark-blue/60 text-sm">
                  Nessun contenuto simile trovato
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};