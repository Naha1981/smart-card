import { streamText, type CoreMessage } from "ai";
import { getModel } from "@/lib/ai/provider";
import { buildToolRegistry } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import type { TenantContext } from "@/lib/db/tenant-scope";
import type { tenants } from "@/lib/db/schema";
import * as chatService from "@/modules/chat/service";

type Tenant = typeof tenants.$inferSelect;

/**
 * The single conversational entry point (PRD F4). Grounded-by-construction:
 * tools are the only way facts reach the model. Streams a response and
 * persists both sides of the turn to `messages`.
 */
export async function converse(
  ctx: TenantContext,
  tenant: Tenant,
  conversationId: string,
  userMessage: string
) {
  await chatService.appendMessage(ctx, conversationId, "user", userMessage);
  const history = await chatService.getHistory(ctx, conversationId);

  const messages: CoreMessage[] = history.map((m) => ({ role: m.role as CoreMessage["role"], content: m.content }));

  const result = streamText({
    model: getModel("planning"),
    system: buildSystemPrompt(tenant),
    messages,
    tools: buildToolRegistry(ctx),
    maxSteps: 6,
    onFinish: async ({ text, toolCalls }) => {
      await chatService.appendMessage(ctx, conversationId, "assistant", text, toolCalls);
    },
  });

  return result;
}
