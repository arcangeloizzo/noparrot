import { Navigate, useParams } from "react-router-dom";

/**
 * Fallback client-side redirect for share links when the Cloudflare
 * `/s/*` proxy is not intercepting the request (real browsers hit the SPA
 * fallback and land here instead of on the share edge function).
 * Crawlers still receive the share function HTML via the proxy.
 */
export default function ShareRedirect() {
  const { type, id } = useParams<{ type: string; id: string }>();
  if (!id) return <Navigate to="/" replace />;
  switch (type) {
    case "post":
    case "challenge":
    case "il_punto":
      return <Navigate to={`/post/${id}`} replace />;
    case "profile":
      return <Navigate to={`/profile/${id}`} replace />;
    default:
      return <Navigate to="/" replace />;
  }
}