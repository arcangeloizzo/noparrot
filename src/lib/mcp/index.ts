import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMyRecentPostsTool from "./tools/list-my-recent-posts";
import listMyNotificationsTool from "./tools/list-my-notifications";

// The OAuth issuer MUST be the direct Supabase host (see ai-mcp-js knowledge).
// Read the project ref from the Vite-inlined env var so this file stays
// import-safe (no runtime env reads at module load).
const projectRef =
  (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "noparrot-mcp",
  title: "NoParrot",
  version: "0.1.0",
  instructions:
    "Tools for NoParrot, a cognitive social platform. Use `whoami` to identify the signed-in user, `list_my_recent_posts` to fetch their recent posts, and `list_my_notifications` to check their notifications. All tools respect the user's row-level security and only return the caller's own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMyRecentPostsTool, listMyNotificationsTool],
});