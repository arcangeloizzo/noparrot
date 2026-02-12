import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCognitiveDensity(userId?: string) {
    const { user } = useAuth();
    const targetUserId = userId || user?.id;

    const { data: cognitiveDensity, isLoading } = useQuery({
        queryKey: ["profile", targetUserId],
        queryFn: async () => {
            if (!targetUserId) return {};

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", targetUserId)
                .single();

            if (error) {
                console.error("Error fetching cognitive density:", error);
                return {};
            }

            return (data?.cognitive_density as Record<string, number>) || {};
        },
        enabled: !!targetUserId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return { data: cognitiveDensity, isLoading };
}
