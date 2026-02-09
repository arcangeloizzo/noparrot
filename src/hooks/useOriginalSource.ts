import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OriginalSource {
  url: string;
  title: string | null;
  image: string | null;
  authorUsername: string;
  authorFullName: string | null;
  authorAvatar?: string | null;
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
  }>;
}

interface AncestorPost {
  id: string;
  shared_url: string | null;
  shared_title: string | null;
  preview_img: string | null;
  quoted_post_id: string | null;
  author: {
    username: string;
    full_name: string | null;
  };
}

const MAX_CHAIN_DEPTH = 10;

/**
 * Traverses the entire quoted_post_id chain to find the FIRST post with a shared_url.
 * Used for multi-level reshares where the original source may be several levels deep.
 */
export function useOriginalSource(quotedPostId: string | null) {
  return useQuery({
    queryKey: ['original-source', quotedPostId],
    queryFn: async (): Promise<OriginalSource | null> => {
      if (!quotedPostId) return null;

      let currentId: string | null = quotedPostId;
      let depth = 0;

      while (currentId && depth < MAX_CHAIN_DEPTH) {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            shared_url,
            shared_title,
            preview_img,
            quoted_post_id,
            author:public_profiles!author_id (
              username,
              full_name,
              avatar_url
            ),
            post_media!post_media_post_id_fkey (
              order_idx,
              media:media_id (
                id,
                type,
                url,
                thumbnail_url
              )
            )
          `)
          .eq('id', currentId)
          .single();

        if (error || !data) break;

        const post: any = data;
        const media = (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean);

        // Found a post with a source URL OR media
        if (post.shared_url || media.length > 0) {
          return {
            url: post.shared_url,
            title: post.shared_title,
            image: post.preview_img,
            authorUsername: post.author.username,
            authorFullName: post.author.full_name,
            authorAvatar: post.author.avatar_url,
            media: media
          };
        }

        // Move to the next ancestor
        currentId = post.quoted_post_id;
        depth++;
      }

      return null;
    },
    enabled: !!quotedPostId,
    staleTime: 5 * 60 * 1000,
  });
}
