import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useDeleteMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Messaggio eliminato");
    },
    onError: () => {
      toast.error("Errore durante l'eliminazione");
    },
  });
}

export function useDeleteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      // Remove user from thread participants (soft delete for user)
      const { error } = await supabase
        .from("thread_participants")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({ queryKey: ["messageThreads"] });
      toast.success("Conversazione eliminata");
    },
    onError: () => {
      toast.error("Errore durante l'eliminazione");
    },
  });
}
