import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Conta totale dei Comprehension Gate superati dall'utente.
 * Usato come hero metric "X cose comprese" nel profilo.
 */
export function useUserComprehensionCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-comprehension-count", userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from("post_gate_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("passed", true);

      if (error) {
        console.error("[useUserComprehensionCount] error:", error);
        return 0;
      }

      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}