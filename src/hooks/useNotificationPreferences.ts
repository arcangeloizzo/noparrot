import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type NotificationPreferenceField =
  | 'notifications_likes_enabled'
  | 'notifications_comments_enabled'
  | 'notifications_mentions_enabled'
  | 'notifications_follows_enabled'
  | 'notifications_messages_enabled'
  | 'notifications_reshares_enabled'
  | 'editorial_notifications_enabled';

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: async ({ field, enabled }: { field: NotificationPreferenceField; enabled: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ [field]: enabled })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      toast.success("Preferenza salvata");
    },
    onError: (error) => {
      console.error("Error updating notification preference:", error);
      toast.error("Errore durante il salvataggio");
    }
  });

  return { toggle };
};
