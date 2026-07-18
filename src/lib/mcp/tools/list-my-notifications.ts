import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "list_my_notifications",
  title: "List my notifications",
  description: "List the signed-in user's recent NoParrot notifications (id, type, message, read status, created_at).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("How many notifications to return (1-50, default 20)."),
    unread_only: z
      .boolean()
      .optional()
      .describe("If true, only return unread notifications."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, unread_only }, ctx: ToolContext) => {
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
    let query = supabase
      .from("notifications")
      .select("id, type, message, read, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (unread_only) query = query.eq("read", false);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const notifications = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(notifications, null, 2) }],
      structuredContent: { notifications },
    };
  },
});