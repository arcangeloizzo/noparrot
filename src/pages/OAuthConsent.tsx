import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

// The installed @supabase/supabase-js does not expose `supabase.auth.oauth`
// at runtime, so we call the managed OAuth 2.1 REST endpoints directly.
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function oauthFetch<T>(path: string, method: "GET" | "POST"): Promise<OAuthResult<T>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { data: null, error: { message: "Not authenticated" } };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method,
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return { data: null, error: { message: body?.error_description || body?.msg || body?.message || `HTTP ${res.status}` } };
    }
    return { data: body as T, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

const authOAuth = {
  getAuthorizationDetails: (id: string) =>
    oauthFetch<AuthorizationDetails>(`/oauth/authorizations/${encodeURIComponent(id)}`, "GET"),
  approveAuthorization: (id: string) =>
    oauthFetch<{ redirect_url?: string; redirect_to?: string }>(
      `/oauth/authorizations/${encodeURIComponent(id)}/approve`,
      "POST",
    ),
  denyAuthorization: (id: string) =>
    oauthFetch<{ redirect_url?: string; redirect_to?: string }>(
      `/oauth/authorizations/${encodeURIComponent(id)}/deny`,
      "POST",
    ),
};

function isSameOriginPath(p: string): boolean {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await authOAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOAuth.approveAuthorization(authorizationId)
      : await authOAuth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl">
          <Logo className="w-auto h-10 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Connessione non riuscita</h1>
          <p className="text-sm text-muted-foreground">
            Non è stato possibile caricare questa richiesta di autorizzazione: {error}
          </p>
        </Card>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl text-center">
          <Logo className="w-auto h-10 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        </Card>
      </div>
    );
  }

  const clientName = details.client?.name ?? "un'app esterna";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-6 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
        <div className="text-center mb-6">
          <Logo className="w-auto h-10 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Collega {clientName} a NoParrot</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {clientName} potrà usare gli strumenti di questa app come te.
          </p>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 mb-6 text-sm space-y-2">
          <p className="font-medium">Cosa viene autorizzato</p>
          <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
            <li>Leggere il tuo profilo (username, nome)</li>
            <li>Leggere i tuoi post recenti</li>
            <li>Leggere le tue notifiche</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2">
            Non aggira le regole di accesso di NoParrot: {clientName} vede solo i dati che vedresti tu.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button disabled={busy} onClick={() => decide(true)} className="w-full">
            {busy ? "Attendere…" : "Approva"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => decide(false)}
            variant="ghost"
            className="w-full"
          >
            Annulla connessione
          </Button>
        </div>
      </Card>
    </div>
  );
}

export { isSameOriginPath };