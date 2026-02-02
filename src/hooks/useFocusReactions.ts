import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FocusReactionData {
  focusId: string;
  focusType: 'daily' | 'interest';
  reactionType?: string;
}

export type FocusReactionType = 'heart' | 'laugh' | 'wow' | 'sad' | 'fire';

interface FocusReactionsResult {
  likes: number;
  likedByMe: boolean;
  myReactionType: FocusReactionType | null;
}

/**
 * Hook per ottenere le reazioni di un focus item
 */
export const useFocusReactions = (focusId: string | undefined, focusType: 'daily' | 'interest') => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['focus-reactions', focusId, focusType],
    queryFn: async (): Promise<FocusReactionsResult> => {
      if (!focusId) return { likes: 0, likedByMe: false, myReactionType: null };

      // Conta i like totali (tutte le reazioni non-bookmark)
      const { count: likes } = await supabase
        .from('focus_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('focus_id', focusId)
        .eq('focus_type', focusType);

      // Controlla la reazione dell'utente corrente
      let likedByMe = false;
      let myReactionType: FocusReactionType | null = null;
      
      if (user) {
        const { data: userReaction } = await supabase
          .from('focus_reactions')
          .select('id, reaction_type')
          .eq('focus_id', focusId)
          .eq('focus_type', focusType)
          .eq('user_id', user.id)
          .maybeSingle();
        
        likedByMe = !!userReaction;
        myReactionType = (userReaction?.reaction_type as FocusReactionType) || null;
      }

      return {
        likes: likes || 0,
        likedByMe,
        myReactionType,
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
    onMutate: async ({ focusId, focusType, reactionType = 'heart' }) => {
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
        const currentReaction = previousReactions.myReactionType;
        const isSameReaction = currentReaction === reactionType;
        
        let newLikes = previousReactions.likes;
        let newLikedByMe: boolean;
        let newMyReactionType: FocusReactionType | null;
        
        if (isSameReaction) {
          // Toggle off
          newLikes = Math.max(0, newLikes - 1);
          newLikedByMe = false;
          newMyReactionType = null;
        } else if (currentReaction) {
          // Switch reaction type (count stays same)
          newLikedByMe = true;
          newMyReactionType = reactionType as FocusReactionType;
        } else {
          // New reaction
          newLikes += 1;
          newLikedByMe = true;
          newMyReactionType = reactionType as FocusReactionType;
        }
        
        queryClient.setQueryData<FocusReactionsResult>(
          ['focus-reactions', focusId, focusType],
          {
            likes: newLikes,
            likedByMe: newLikedByMe,
            myReactionType: newMyReactionType,
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
