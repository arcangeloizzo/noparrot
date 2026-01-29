import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FocusReactionData {
  focusId: string;
  focusType: 'daily' | 'interest';
  reactionType?: string;
}

interface FocusReactionsResult {
  likes: number;
  likedByMe: boolean;
}

/**
 * Hook per ottenere le reazioni di un focus item
 */
export const useFocusReactions = (focusId: string | undefined, focusType: 'daily' | 'interest') => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['focus-reactions', focusId, focusType],
    queryFn: async (): Promise<FocusReactionsResult> => {
      if (!focusId) return { likes: 0, likedByMe: false };

      // Conta i like totali
      const { count: likes } = await supabase
        .from('focus_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .eq('reaction_type', 'heart');

      // Controlla se l'utente ha messo like
      let likedByMe = false;
      if (user) {
        const { data: userReaction } = await supabase
          .from('focus_reactions')
          .select('id')
          .eq('focus_id', focusId)
          .eq('focus_type', focusType)
          .eq('user_id', user.id)
          .eq('reaction_type', 'heart')
          .maybeSingle();
        
        likedByMe = !!userReaction;
      }

      return {
        likes: likes || 0,
        likedByMe,
      };
    },
    enabled: !!focusId,
  });
};

/**
 * Mutation per aggiungere/rimuovere like da un focus item
 * Con optimistic updates per feedback immediato
 */
export const useToggleFocusReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ focusId, focusType, reactionType = 'heart' }: FocusReactionData) => {
      if (!user) throw new Error('User not authenticated');

      // Controlla se esiste già
      const { data: existing } = await supabase
        .from('focus_reactions')
        .select('id')
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType)
        .maybeSingle();

      if (existing) {
        // Rimuovi like
        const { error } = await supabase
          .from('focus_reactions')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        
        // Aggiorna il count nella cache della tabella focus
        const table = focusType === 'daily' ? 'daily_focus' : 'interest_focus';
        const { data: focusItem } = await supabase
          .from(table)
          .select('reactions')
          .eq('id', focusId)
          .single();

        if (focusItem?.reactions) {
          const reactions = focusItem.reactions as any;
          await supabase
            .from(table)
            .update({
              reactions: {
                ...reactions,
                likes: Math.max(0, (reactions.likes || 0) - 1),
              }
            } as any)
            .eq('id', focusId);
        }

        return { action: 'removed' };
      } else {
        // Aggiungi like
        const { error } = await supabase
          .from('focus_reactions')
          .insert({
            focus_id: focusId,
            focus_type: focusType,
            user_id: user.id,
            reaction_type: reactionType,
          });

        if (error) throw error;

        // Aggiorna il count nella cache della tabella focus
        const table = focusType === 'daily' ? 'daily_focus' : 'interest_focus';
        const { data: focusItem } = await supabase
          .from(table)
          .select('reactions')
          .eq('id', focusId)
          .single();

        if (focusItem?.reactions) {
          const reactions = focusItem.reactions as any;
          await supabase
            .from(table)
            .update({
              reactions: {
                ...reactions,
                likes: (reactions.likes || 0) + 1,
              }
            } as any)
            .eq('id', focusId);
        }

        return { action: 'added' };
      }
    },
    
    // ===== OPTIMISTIC UI: Instant feedback, rollback on error =====
    onMutate: async ({ focusId, focusType }) => {
      if (!user) return;
      
      // 1. Cancel in-flight queries to avoid race conditions
      await queryClient.cancelQueries({ 
        queryKey: ['focus-reactions', focusId, focusType] 
      });
      
      // 2. Snapshot previous state for rollback
      const previousReactions = queryClient.getQueryData<FocusReactionsResult>(
        ['focus-reactions', focusId, focusType]
      );
      
      // 3. Optimistically update cache immediately
      if (previousReactions) {
        const wasLiked = previousReactions.likedByMe;
        queryClient.setQueryData<FocusReactionsResult>(
          ['focus-reactions', focusId, focusType],
          {
            likes: previousReactions.likes + (wasLiked ? -1 : 1),
            likedByMe: !wasLiked,
          }
        );
      }
      
      // 4. Return context for rollback
      return { previousReactions };
    },
    
    // Rollback on error
    onError: (_err, variables, context) => {
      if (context?.previousReactions) {
        queryClient.setQueryData(
          ['focus-reactions', variables.focusId, variables.focusType],
          context.previousReactions
        );
      }
      toast.error('Errore durante la registrazione della reazione');
    },
    
    // Background sync for consistency (no blocking)
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['focus-reactions', variables.focusId, variables.focusType] 
      });
      queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
      queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
    },
  });
};
