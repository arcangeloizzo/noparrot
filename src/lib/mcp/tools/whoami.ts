import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in NoParrot user's basic profile (id, username, full name).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const userId = ctx.getUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, bio")
      .eq("id", userId!)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const profile = data ?? { id: userId, username: null, full_name: null, bio: null };
    return {
      content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      structuredContent: { profile },
    };
  },
});