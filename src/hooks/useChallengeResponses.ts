import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChallengeResponse {
  id: string;
  challenge_id: string;
  user_id: string;
  stance: "for" | "against";
  argument_votes: number;
  gate_passed: boolean;
  voice_post_id: string;
  user: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  voice_post: {
    audio_url: string;
    duration_seconds: number;
    waveform_data: number[] | null;
    transcript: string | null;
    transcript_status: string | null;
  };
}

export function useChallengeResponses(challengeId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const responsesQuery = useQuery({
    queryKey: ["challenge-responses", challengeId],
    enabled: !!challengeId,
    queryFn: async (): Promise<ChallengeResponse[]> => {
      if (!challengeId) return [];

      const { data: responses, error } = await supabase
        .from("challenge_responses")
        .select("id, challenge_id, user_id, stance, argument_votes, gate_passed, voice_post_id")
        .eq("challenge_id", challengeId)
        .order("argument_votes", { ascending: false });

      if (error) throw error;
      if (!responses || responses.length === 0) return [];

      // Fetch profiles
      const userIds = [...new Set(responses.map((r) => r.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      // Fetch voice posts
      const vpIds = responses.map((r) => r.voice_post_id).filter(Boolean) as string[];
      const { data: voicePosts } = await supabase
        .from("voice_posts")
        .select("id, audio_url, duration_seconds, waveform_data, transcript, transcript_status")
        .in("id", vpIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const vpMap = new Map((voicePosts || []).map((v) => [v.id, v]));

      return responses.map((r) => {
        const profile = profileMap.get(r.user_id || "") || {
          username: "utente",
          full_name: null,
          avatar_url: null,
        };
        const vp = vpMap.get(r.voice_post_id || "") || {
          audio_url: "",
          duration_seconds: 0,
          waveform_data: null,
          transcript: null,
          transcript_status: null,
        };
        return {
          ...r,
          user_id: r.user_id || "",
          challenge_id: r.challenge_id || "",
          voice_post_id: r.voice_post_id || "",
          gate_passed: r.gate_passed ?? false,
          argument_votes: r.argument_votes ?? 0,
          stance: r.stance as "for" | "against",
          user: profile,
          voice_post: {
            ...vp,
            waveform_data: vp.waveform_data as number[] | null,
          },
        };
      });
    },
  });

  // Fetch user's vote for this challenge
  const userVoteQuery = useQuery({
    queryKey: ["challenge-user-vote", challengeId, user?.id],
    enabled: !!challengeId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_votes")
        .select("id, challenge_response_id")
        .eq("challenge_id", challengeId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const voteForResponse = useMutation({
    mutationFn: async (responseId: string) => {
      if (!user || !challengeId) throw new Error("Not authenticated");
      const { error } = await supabase.from("challenge_votes").insert({
        challenge_response_id: responseId,
        challenge_id: challengeId,
        user_id: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Miglior argomento votato!");
      queryClient.invalidateQueries({ queryKey: ["challenge-user-vote", challengeId] });
      queryClient.invalidateQueries({ queryKey: ["challenge-responses", challengeId] });
    },
    onError: () => {
      toast.error("Errore durante il voto");
    },
  });

  return {
    responses: responsesQuery.data || [],
    userVote: userVoteQuery.data || null,
    isLoading: responsesQuery.isLoading,
    voteForResponse: voteForResponse.mutate,
  };
}
