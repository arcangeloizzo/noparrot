import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
import { Post as PostType } from "@/hooks/usePosts";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Post = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  const { data: post, isLoading, error } = useQuery<PostType>({
    queryKey: ['post', postId],
    queryFn: async () => {
      if (!postId) throw new Error('Post ID is required');

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          questions (*),
          reactions (
            reaction_type,
            user_id
          ),
          comments(count)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        author: data.author,
        content: data.content,
        topic_tag: data.topic_tag,
        shared_title: data.shared_title,
        shared_url: data.shared_url,
        preview_img: data.preview_img,
        full_article: data.full_article,
        article_content: data.article_content,
        trust_level: data.trust_level as 'BASSO' | 'MEDIO' | 'ALTO' | null,
        stance: data.stance as 'Condiviso' | 'Confutato' | null,
        sources: (Array.isArray(data.sources) ? data.sources : []) as string[],
        created_at: data.created_at,
        quoted_post_id: data.quoted_post_id,
        quoted_post: null,
        media: [],
        reactions: {
          hearts: data.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
          comments: data.comments?.[0]?.count || 0
        },
        user_reactions: {
          has_hearted: data.reactions?.some((r: any) => r.reaction_type === 'heart') || false,
          has_bookmarked: data.reactions?.some((r: any) => r.reaction_type === 'bookmark') || false
        },
        questions: (data.questions || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            options: q.options as string[],
            correct_index: q.correct_index
          }))
      };
    },
    enabled: !!postId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-muted-foreground">Caricamento...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container">
          <div className="p-4 border-b border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
          </div>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Post non trovato</h2>
              <p className="text-muted-foreground text-sm">
                Il post che stai cercando non esiste o è stato rimosso
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <div className="p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
          </div>
        </div>

        {/* Post */}
        <div className="border-b border-border">
          <FeedCard post={post} />
        </div>
      </div>
    </div>
  );
};
