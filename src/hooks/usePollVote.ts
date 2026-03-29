import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface PollOption {
  id: string;
  label: string;
  order_idx: number;
  vote_count: number;
}

export interface PollData {
  id: string;
  post_id: string;
  expires_at: string | null;
  created_at: string;
  options: PollOption[];
  total_votes: number;
  /** For single-select polls, the voted option id (null if not voted) */
  user_vote_option_id: string | null;
  /** For multi-select polls, all voted option ids */
  user_vote_option_ids: string[];
  is_expired: boolean;
  allow_multiple: boolean;
}

export const usePollForPost = (postId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['poll', postId],
    enabled: !!postId,
    staleTime: 30_000,
    queryFn: async (): Promise<PollData | null> => {
      if (!postId) return null;

      const { data: poll, error: pollErr } = await (supabase
        .from('polls')
        .select('id, post_id, expires_at, created_at, allow_multiple')
        .eq('post_id', postId)
        .maybeSingle() as any);

      if (pollErr || !poll) return null;

      const { data: options, error: optErr } = await (supabase
        .from('poll_options')
        .select('id, label, order_idx')
        .eq('poll_id', poll.id)
        .order('order_idx') as any);

      if (optErr || !options) return null;

      const { data: votes } = await (supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', poll.id) as any);

      const voteCounts: Record<string, number> = {};
      (votes || []).forEach((v: any) => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });

      let userVoteOptionIds: string[] = [];
      if (user) {
        const { data: userVotes } = await (supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', poll.id)
          .eq('user_id', user.id) as any);
        userVoteOptionIds = (userVotes || []).map((v: any) => v.option_id);
      }

      const totalVotes = (votes || []).length;
      const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;

      return {
        id: poll.id,
        post_id: poll.post_id,
        expires_at: poll.expires_at,
        created_at: poll.created_at,
        allow_multiple: poll.allow_multiple ?? false,
        options: options.map((o: any) => ({
          ...o,
          vote_count: voteCounts[o.id] || 0,
        })),
        total_votes: totalVotes,
        user_vote_option_id: userVoteOptionIds[0] || null,
        user_vote_option_ids: userVoteOptionIds,
        is_expired: isExpired,
      };
    },
  });

  useEffect(() => {
    if (!query.data?.id) return;

    const channel = supabase
      .channel(`poll-votes-${query.data.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
          filter: `poll_id=eq.${query.data.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['poll', postId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.data?.id, postId, queryClient]);

  return query;
};

export const useVotePoll = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ pollId, optionId, postId, allowMultiple }: { pollId: string; optionId: string; postId: string; allowMultiple?: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (allowMultiple) {
        // Multi-select: toggle this specific option
        const { data: existing } = await (supabase
          .from('poll_votes')
          .select('id')
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .eq('option_id', optionId)
          .maybeSingle() as any);

        if (existing) {
          await (supabase.from('poll_votes').delete().eq('id', existing.id) as any);
          return { action: 'removed' as const };
        } else {
          await (supabase.from('poll_votes').insert({
            poll_id: pollId,
            option_id: optionId,
            user_id: user.id,
          }) as any);
          return { action: 'voted' as const };
        }
      } else {
        // Single-select: existing logic
        const { data: existing } = await (supabase
          .from('poll_votes')
          .select('id, option_id')
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .maybeSingle() as any);

        if (existing) {
          if (existing.option_id === optionId) {
            await (supabase.from('poll_votes').delete().eq('id', existing.id) as any);
            return { action: 'removed' as const };
          } else {
            await (supabase
              .from('poll_votes')
              .update({ option_id: optionId })
              .eq('id', existing.id) as any);
            return { action: 'changed' as const };
          }
        } else {
          await (supabase.from('poll_votes').insert({
            poll_id: pollId,
            option_id: optionId,
            user_id: user.id,
          }) as any);
          return { action: 'voted' as const };
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['poll', variables.postId] });
    },
  });
};
