import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export const getSessionTokensFromHash = (): SessionTokens | null => {
  if (typeof window === "undefined" || !window.location.hash) return null;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
};

export const restoreSessionFromUrlHash = async (): Promise<Session | null> => {
  const tokens = getSessionTokensFromHash();
  if (!tokens) return null;

  const { data, error } = await supabase.auth.setSession(tokens);
  if (error) throw error;

  return data.session;
};