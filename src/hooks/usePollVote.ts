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
  user_vote_option_id: string | null;
  is_expired: boolean;
}

export const usePollForPost = (postId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['poll', postId],
    enabled: !!postId && !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<PollData | null> => {
      if (!postId) return null;

      // Fetch poll
      const { data: poll, error: pollErr } = await (supabase
        .from('polls')
        .select('id, post_id, expires_at, created_at')
        .eq('post_id', postId)
        .maybeSingle() as any);

      if (pollErr || !poll) return null;

      // Fetch options
      const { data: options, error: optErr } = await (supabase
        .from('poll_options')
        .select('id, label, order_idx')
        .eq('poll_id', poll.id)
        .order('order_idx') as any);

      if (optErr || !options) return null;

      // Fetch vote counts
      const { data: votes, error: votesErr } = await (supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', poll.id) as any);

      // Count per option
      const voteCounts: Record<string, number> = {};
      (votes || []).forEach((v: any) => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });

      // User's vote
      let userVoteOptionId: string | null = null;
      if (user) {
        const { data: userVote } = await (supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', poll.id)
          .eq('user_id', user.id)
          .maybeSingle() as any);
        userVoteOptionId = userVote?.option_id || null;
      }

      const totalVotes = (votes || []).length;
      const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;

      return {
        id: poll.id,
        post_id: poll.post_id,
        expires_at: poll.expires_at,
        created_at: poll.created_at,
        options: options.map((o: any) => ({
          ...o,
          vote_count: voteCounts[o.id] || 0,
        })),
        total_votes: totalVotes,
        user_vote_option_id: userVoteOptionId,
        is_expired: isExpired,
      };
    },
  });

  // Realtime subscription for live vote updates
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
    mutationFn: async ({ pollId, optionId, postId }: { pollId: string; optionId: string; postId: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if user already voted
      const { data: existing } = await (supabase
        .from('poll_votes')
        .select('id, option_id')
        .eq('poll_id', pollId)
        .eq('user_id', user.id)
        .maybeSingle() as any);

      if (existing) {
        if (existing.option_id === optionId) {
          // Same option - remove vote
          await (supabase.from('poll_votes').delete().eq('id', existing.id) as any);
          return { action: 'removed' as const };
        } else {
          // Different option - change vote
          await (supabase
            .from('poll_votes')
            .update({ option_id: optionId })
            .eq('id', existing.id) as any);
          return { action: 'changed' as const };
        }
      } else {
        // New vote
        await (supabase.from('poll_votes').insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: user.id,
        }) as any);
        return { action: 'voted' as const };
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['poll', variables.postId] });
    },
  });
};
