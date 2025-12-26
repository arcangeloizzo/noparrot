import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PENDING_CONSENT_KEY = "noparrot-pending-consent";
const CONSENT_COMPLETED_KEY = "noparrot-consent-completed";

export interface UserConsent {
  id?: string;
  user_id?: string;
  accepted_terms: boolean;
  accepted_privacy: boolean;
  ads_personalization_opt_in: boolean;
  consent_version: string;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  ads_opt_in_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface PendingConsent {
  accepted_terms: boolean;
  accepted_privacy: boolean;
  ads_personalization_opt_in: boolean;
  consent_version: string;
  ts: number;
}

// Helper to check if consent flow is completed
export const isConsentCompleted = (): boolean => {
  return localStorage.getItem(CONSENT_COMPLETED_KEY) === "true";
};

// Helper to set consent as completed
export const setConsentCompleted = (): void => {
  localStorage.setItem(CONSENT_COMPLETED_KEY, "true");
};

// Get pending consent from localStorage (pre-auth)
export const getPendingConsent = (): PendingConsent | null => {
  try {
    const stored = localStorage.getItem(PENDING_CONSENT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error reading pending consent:", e);
  }
  return null;
};

// Save pending consent to localStorage (pre-auth)
export const savePendingConsent = (consent: Omit<PendingConsent, "ts">): void => {
  localStorage.setItem(
    PENDING_CONSENT_KEY,
    JSON.stringify({ ...consent, ts: Date.now() })
  );
};

// Clear pending consent from localStorage
export const clearPendingConsent = (): void => {
  localStorage.removeItem(PENDING_CONSENT_KEY);
};

// Hook to fetch user consents
export const useUserConsents = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-consents", user?.id],
    queryFn: async (): Promise<UserConsent | null> => {
      if (!user) {
        // Return pending consent from localStorage
        const pending = getPendingConsent();
        if (pending) {
          return {
            accepted_terms: pending.accepted_terms,
            accepted_privacy: pending.accepted_privacy,
            ads_personalization_opt_in: pending.ads_personalization_opt_in,
            consent_version: pending.consent_version,
          };
        }
        return null;
      }

      const { data, error } = await supabase
        .from("user_consents")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user consents:", error);
        throw error;
      }

      return data;
    },
    enabled: true,
  });
};

// Mutation to upsert user consents
export const useUpsertConsents = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consent: Partial<UserConsent>) => {
      if (!user) {
        // Save to localStorage for pre-auth
        savePendingConsent({
          accepted_terms: consent.accepted_terms ?? false,
          accepted_privacy: consent.accepted_privacy ?? false,
          ads_personalization_opt_in: consent.ads_personalization_opt_in ?? false,
          consent_version: consent.consent_version ?? "v1",
        });
        setConsentCompleted();
        return null;
      }

      const now = new Date().toISOString();
      const payload = {
        user_id: user.id,
        accepted_terms: consent.accepted_terms ?? false,
        accepted_privacy: consent.accepted_privacy ?? false,
        ads_personalization_opt_in: consent.ads_personalization_opt_in ?? false,
        consent_version: consent.consent_version ?? "v1",
        terms_accepted_at: consent.accepted_terms ? now : null,
        privacy_accepted_at: consent.accepted_privacy ? now : null,
        ads_opt_in_at: consent.ads_personalization_opt_in ? now : null,
      };

      const { data, error } = await supabase
        .from("user_consents")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        console.error("Error upserting consents:", error);
        throw error;
      }

      setConsentCompleted();
      clearPendingConsent();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-consents"] });
    },
  });
};

// Mutation to toggle ads personalization
export const useToggleAdsPersonalization = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optIn: boolean) => {
      if (!user) {
        // Update localStorage
        const pending = getPendingConsent();
        if (pending) {
          savePendingConsent({
            ...pending,
            ads_personalization_opt_in: optIn,
          });
        }
        return null;
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_consents")
        .update({
          ads_personalization_opt_in: optIn,
          ads_opt_in_at: optIn ? now : null,
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error toggling ads personalization:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-consents"] });
    },
  });
};

// Helper to get ad mode
export const getAdMode = (consents: UserConsent | null | undefined): "contextual" | "interest" => {
  if (!consents) return "contextual";
  return consents.ads_personalization_opt_in ? "interest" : "contextual";
};

// Sync pending consents from localStorage to Supabase (call after login/signup)
export const syncPendingConsents = async (userId: string): Promise<void> => {
  const pending = getPendingConsent();
  if (!pending) return;

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    accepted_terms: pending.accepted_terms,
    accepted_privacy: pending.accepted_privacy,
    ads_personalization_opt_in: pending.ads_personalization_opt_in,
    consent_version: pending.consent_version,
    terms_accepted_at: pending.accepted_terms ? now : null,
    privacy_accepted_at: pending.accepted_privacy ? now : null,
    ads_opt_in_at: pending.ads_personalization_opt_in ? now : null,
  };

  const { error } = await supabase
    .from("user_consents")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Error syncing pending consents:", error);
  } else {
    clearPendingConsent();
  }
};
