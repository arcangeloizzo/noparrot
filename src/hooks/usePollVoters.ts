import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PollVoter {
  id: string;
  user_id: string;
  option_id: string;
  option_label: string;
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface PollVotersData {
  voters: PollVoter[];
  byOption: Record<string, PollVoter[]>;
  totalCount: number;
  optionLabels: Record<string, string>;
}

export const usePollVoters = (pollId: string | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['poll-voters', pollId],
    queryFn: async (): Promise<PollVotersData> => {
      if (!pollId) return { voters: [], byOption: {}, totalCount: 0, optionLabels: {} };

      // Fetch options for labels
      const { data: options } = await (supabase
        .from('poll_options')
        .select('id, label')
        .eq('poll_id', pollId)
        .order('order_idx') as any);

      const optionLabels: Record<string, string> = {};
      (options || []).forEach((o: any) => { optionLabels[o.id] = o.label; });

      // Fetch votes
      const { data: votes, error } = await (supabase
        .from('poll_votes')
        .select('id, user_id, option_id, created_at')
        .eq('poll_id', pollId)
        .order('created_at', { ascending: false }) as any);

      if (error || !votes || votes.length === 0) {
        return { voters: [], byOption: {}, totalCount: 0, optionLabels };
      }

      // Fetch profiles
      const userIds: string[] = Array.from(new Set(votes.map((v: any) => String(v.user_id))));
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

      const voters: PollVoter[] = votes.map((v: any) => ({
        id: v.id,
        user_id: v.user_id,
        option_id: v.option_id,
        option_label: optionLabels[v.option_id] || '',
        user: profilesMap.get(v.user_id) || null,
      })).filter((v: PollVoter) => v.user !== null);

      const byOption: Record<string, PollVoter[]> = {};
      for (const optId of Object.keys(optionLabels)) {
        byOption[optId] = voters.filter(v => v.option_id === optId);
      }

      return { voters, byOption, totalCount: voters.length, optionLabels };
    },
    enabled: !!pollId && enabled,
    staleTime: 30000,
  });
};
