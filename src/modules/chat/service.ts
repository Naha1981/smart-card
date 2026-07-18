import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, messages, customers } from "@/lib/db/schema";
import { scoped, type TenantContext } from "@/lib/db/tenant-scope";
import { emit } from "@/lib/events/bus";

export async function getOrCreateConversation(
  ctx: TenantContext,
  channel: "whatsapp" | "web" | "mobile" | "voice",
  customerId?: string
) {
  if (customerId) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(scoped(conversations, ctx, eq(conversations.customerId, customerId)))
      .limit(1);
    if (existing && existing.status === "open") return existing;
  }
  const [conversation] = await db
    .insert(conversations)
    .values({ tenantId: ctx.tenantId, customerId, channel, status: "open" })
    .returning();
  return conversation;
}

export async function appendMessage(
  ctx: TenantContext,
  conversationId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  toolCalls?: unknown
) {
  const [message] = await db
    .insert(messages)
    .values({ tenantId: ctx.tenantId, conversationId, role, content, toolCalls })
    .returning();
  if (role === "user") await emit(ctx, "MessageReceived", { conversationId, messageId: message.id });
  return message;
}

export async function getHistory(ctx: TenantContext, conversationId: string) {
  return db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(scoped(messages, ctx, eq(messages.conversationId, conversationId)))
    .orderBy(messages.createdAt);
}

export async function escalateToHuman(ctx: TenantContext, conversationId: string, reason: string) {
  await db.update(conversations).set({ status: "escalated" }).where(eq(conversations.id, conversationId));
  await emit(ctx, "HumanEscalated", { conversationId, reason });
  return { escalated: true, reason };
}

export async function saveList(ctx: TenantContext, customerId: string, name: string, items: string[]) {
  const [customer] = await db.select().from(customers).where(scoped(customers, ctx, eq(customers.id, customerId)));
  if (!customer) throw new Error("Customer not found");
  const preferences = { ...(customer.preferences ?? {}), savedLists: { ...(customer.preferences as any)?.savedLists, [name]: items } };
  await db.update(customers).set({ preferences }).where(eq(customers.id, customerId));
  return { saved: true, name, itemCount: items.length };
}
