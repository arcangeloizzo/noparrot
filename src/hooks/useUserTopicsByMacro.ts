import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopicData {
  topic_id: string;
  topic_label: string;
  frequency: number;
}

/**
 * Ritorna i topic-tag dell'utente per una specifica macro-categoria,
 * ordinati per frequenza decrescente. Usato dai sub-dot della Nebulosa
 * (vista zoom-in di un singolo pianeta).
 */
export function useUserTopicsByMacro(
  userId: string | undefined | null,
  macroCategory: string | undefined | null
) {
  return useQuery<TopicData[]>({
    queryKey: ["user-topics-by-macro", userId, macroCategory],
    queryFn: async () => {
      if (!userId || !macroCategory) return [];

      const { data, error } = await supabase.rpc("get_user_topics_by_macro", {
        p_user_id: userId,
        p_macro_category: macroCategory,
      });

      if (error) {
        console.error("[useUserTopicsByMacro] error:", error);
        return [];
      }

      return (data ?? []) as TopicData[];
    },
    enabled: !!userId && !!macroCategory,
    staleTime: 1000 * 60 * 5,
  });
}