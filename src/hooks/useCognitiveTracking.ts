import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useCognitiveTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const toggleTracking = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({ cognitive_tracking_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["currentProfile"] });
      toast.success(
        enabled 
          ? "Feed personalizzato attivato" 
          : "Feed personalizzato disattivato"
      );
    },
    onError: () => {
      toast.error("Errore durante l'aggiornamento");
    },
  });

  return { toggleTracking };
}
