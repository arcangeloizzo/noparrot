import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaViewer } from "@/components/media/MediaViewer";
import { Heart, MessageCircle, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface MediaResultsProps {
  query: string;
}

export const MediaResults = ({ query }: MediaResultsProps) => {
  const [selectedMedia, setSelectedMedia] = useState<any>(null);

  const { data: mediaItems, isLoading } = useQuery({
    queryKey: ["search-media", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // Search for posts that contain media and match the query
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          created_at,
          profiles!posts_author_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .or(`content.ilike.%${query}%,shared_title.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Now get media for these posts
      const postIds = (posts || []).map(p => p.id);
      if (postIds.length === 0) return [];

      const { data: mediaData, error: mediaError } = await supabase
        .from("post_media")
        .select(`
          *,
          media (*)
        `)
        .in("post_id", postIds)
        .limit(50);

      if (mediaError) throw mediaError;

      // Combine with post data
      return (mediaData || []).map(item => ({
        ...item,
        post: posts.find(p => p.id === item.post_id)
      })).filter(item => item.media);
    },
    enabled: !!query && query.length >= 2,
  });

  if (isLoading || !mediaItems || mediaItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1 p-1">
        {mediaItems.map((item) => {
          const media = item.media;
          const post = item.post;
          const isVideo = media?.type === "video";

          return (
            <button
              key={item.id}
              onClick={() => setSelectedMedia(media)}
              className="relative aspect-square bg-muted rounded-lg overflow-hidden group"
            >
              {media?.url && (
                <img
                  src={media.thumbnail_url || media.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}

              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-black ml-1" />
                  </div>
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={post?.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        <User className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium truncate">
                      {post?.profiles?.full_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> 0
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> 0
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedMedia && (
        <MediaViewer
          media={[selectedMedia]}
          initialIndex={0}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </>
  );
};
