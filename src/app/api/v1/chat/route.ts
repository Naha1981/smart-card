import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateConversation } from "@/modules/chat/service";
import { converse } from "@/modules/ai/engine";
import type { TenantContext } from "@/lib/db/tenant-scope";
import { z } from "zod";

const bodySchema = z.object({
  tenantSlug: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
  sessionCustomerId: z.string().optional(),
});

/**
 * Public endpoint consumed by the embeddable web widget (F6). Rate-limited
 * per Architecture Standard §7/§8 (add a limiter middleware before go-live).
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: parsed.error.message } }, { status: 400 });
  }
  const { tenantSlug, conversationId, message, sessionCustomerId } = parsed.data;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug));
  if (!tenant) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown tenant" } }, { status: 404 });
  }

  // Web widget customers are anonymous/session-scoped, not staff — a lightweight
  // system-role context scoped to this tenant only.
  const ctx: TenantContext = { tenantId: tenant.id, userId: "system:web-widget", role: "agent" };
  const conversation = conversationId
    ? { id: conversationId }
    : await getOrCreateConversation(ctx, "web", sessionCustomerId);

  const result = await converse(ctx, tenant, conversation.id, message);
  return result.toDataStreamResponse({ headers: { "x-conversation-id": conversation.id } });
}
