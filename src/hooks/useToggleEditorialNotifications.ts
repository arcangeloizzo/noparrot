import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useToggleEditorialNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({ editorial_notifications_enabled: enabled })
        .eq("id", user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      toast.success(enabled 
        ? "Notifiche Il Punto attivate" 
        : "Notifiche Il Punto disattivate"
      );
    },
    onError: () => {
      toast.error("Errore durante il salvataggio");
    },
  });
};
