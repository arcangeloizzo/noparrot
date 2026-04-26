import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CognitiveDensityRow {
    macro_category: string;
    density: number;
    action_breakdown: Record<string, number>;
}

export interface CognitiveDensityData {
    rows: CognitiveDensityRow[];
    totalDensity: number;
    byMacro: Record<string, CognitiveDensityRow>;
    /** Flat map { macro_category: density } per back-compat con i renderer */
    byMacroFlat: Record<string, number>;
}

const EMPTY: CognitiveDensityData = {
    rows: [],
    totalDensity: 0,
    byMacro: {},
    byMacroFlat: {},
};

export function useCognitiveDensity(userId?: string, isOwnProfile: boolean = false) {
    const { user } = useAuth();
    const targetUserId = userId || user?.id;

    // Se non specificato, deduce isOwnProfile dal confronto con auth user
    const ownProfile = isOwnProfile || (!!targetUserId && targetUserId === user?.id);

    const { data, isLoading } = useQuery<CognitiveDensityData>({
        queryKey: ["cognitive-density-derived", targetUserId, ownProfile],
        queryFn: async () => {
            if (!targetUserId) return EMPTY;

            // Wrapper fresh solo per profilo proprio (refresh on-demand della MV).
            // Profili altrui: lettura diretta (più veloce, può essere stale ~5 min).
            const rpcName = ownProfile
                ? "get_user_cognitive_density_fresh"
                : "get_user_cognitive_density";

            const { data: rpcData, error } = await supabase.rpc(rpcName, {
                p_user_id: targetUserId,
            });

            if (error) {
                console.error("[useCognitiveDensity] RPC error:", error);
                return EMPTY;
            }

            const rows: CognitiveDensityRow[] = (rpcData ?? []).map((r: any) => ({
                macro_category: r.macro_category,
                density: Number(r.density ?? 0),
                action_breakdown:
                    (r.action_breakdown as Record<string, number>) || {},
            }));

            const totalDensity = rows.reduce((sum, r) => sum + r.density, 0);
            const byMacro = Object.fromEntries(
                rows.map((r) => [r.macro_category, r])
            );
            const byMacroFlat = Object.fromEntries(
                rows.map((r) => [r.macro_category, r.density])
            );

            return { rows, totalDensity, byMacro, byMacroFlat };
        },
        enabled: !!targetUserId,
        staleTime: 1000 * 60 * 5,
    });

    return { data: data ?? EMPTY, isLoading };
}
