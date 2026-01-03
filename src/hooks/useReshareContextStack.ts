import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWordCount } from '@/lib/gate-utils';

export interface ContextItem {
  id: string;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  content: string;
  created_at: string;
}

interface AncestorPost {
  id: string;
  content: string;
  created_at: string;
  quoted_post_id: string | null;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const SHORT_COMMENT_THRESHOLD = 30; // words
const MAX_CHAIN_DEPTH = 10; // safety limit

/**
 * Traverses the quoted_post_id chain and collects short comments (< threshold words).
 * Stops when:
 * - quoted_post_id is null
 * - A long comment (>= threshold) is found
 * - Max depth is reached
 */
export function useReshareContextStack(quotedPostId: string | null) {
  return useQuery({
    queryKey: ['reshare-context-stack', quotedPostId],
    queryFn: async (): Promise<ContextItem[]> => {
      if (!quotedPostId) return [];

      const stack: ContextItem[] = [];
      let currentId: string | null = quotedPostId;
      let depth = 0;

      while (currentId && depth < MAX_CHAIN_DEPTH) {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            created_at,
            quoted_post_id,
            author:profiles!author_id (
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('id', currentId)
          .single();

        if (error || !data) break;

        const post = data as unknown as AncestorPost;
        const wordCount = getWordCount(post.content);

        // If this is a long comment (interpretation), stop here
        if (wordCount >= SHORT_COMMENT_THRESHOLD) {
          break;
        }

        // Add to stack
        stack.push({
          id: post.id,
          author: post.author,
          content: post.content,
          created_at: post.created_at,
        });

        // Move to the next ancestor
        currentId = post.quoted_post_id;
        depth++;
      }

      return stack;
    },
    enabled: !!quotedPostId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
