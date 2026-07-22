// Trust Score API (estratta da comprehension-gate.tsx durante la blindatura del gate).
// L'ex file comprehension-gate.tsx è stato eliminato insieme a GateButton/CGProvider.

export type TrustScoreResult = {
  band: "BASSO" | "MEDIO" | "ALTO";
  score: number;
  reasons: string[];
  color: string;
  hasSources: boolean;
};

export async function fetchTrustScore({
  postText,
  sources,
  authorUsername,
  isVerified,
}: {
  postText: string;
  sources: string[];
  userMeta?: any;
  authorUsername?: string;
  isVerified?: boolean;
}): Promise<TrustScoreResult | null> {
  try {
    const sourceUrl = sources[0];
    if (!sourceUrl) return null;

    const { supabase } = await import("@/integrations/supabase/client");

    const { data, error } = await supabase.functions.invoke("evaluate-trust-score", {
      body: { sourceUrl, postText, authorUsername, isVerified },
    });

    if (error || !data) return null;

    return {
      band: data.band,
      score: data.score,
      reasons: data.reasons || [],
      color:
        data.band === "ALTO"
          ? "hsl(var(--success))"
          : data.band === "MEDIO"
            ? "hsl(var(--warning))"
            : "hsl(var(--destructive))",
      hasSources: true,
    };
  } catch (err) {
    console.error("[TrustScore] error:", err);
    return null;
  }
}