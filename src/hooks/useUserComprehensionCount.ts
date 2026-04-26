import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Conta i post DISTINTI per cui l'utente ha dimostrato comprensione,
 * sommando gate superati e commenti consapevoli (passed_gate=true)
 * senza doppi conteggi quando un post compare in entrambi i set.
 * Usato come hero metric "X cose comprese" nel profilo.
 */
export function useUserComprehensionCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-comprehension-count", userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { data, error } = await supabase.rpc("get_user_comprehension_count", {
        p_user_id: userId,
      });

      if (error) {
        console.error("[useUserComprehensionCount] error:", error);
        return 0;
      }

      return Number(data ?? 0);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}