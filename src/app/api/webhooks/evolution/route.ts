import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tenants, integrations, customers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { normalizeInboundMessage, sendText } from "@/lib/integrations/evolution/client";
import { getOrCreateConversation } from "@/modules/chat/service";
import { converse } from "@/modules/ai/engine";
import type { TenantContext } from "@/lib/db/tenant-scope";
import crypto from "node:crypto";

/**
 * Shared webhook for ALL tenant WhatsApp instances — routes by instance name
 * (Architecture Standard §5). Responds fast, ignores bot-authored messages.
 * Instance -> tenant resolution: `integrations.credentials->>'instanceName'`
 * is matched against the inbound payload's `instance` field. Each tenant
 * gets exactly one `integrations` row with provider='evolution'.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json();

  const secret = req.headers.get("x-webhook-secret");
  if (process.env.EVOLUTION_WEBHOOK_SECRET && secret !== process.env.EVOLUTION_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inbound = normalizeInboundMessage(payload);
  if (!inbound || inbound.isFromBot || !inbound.text) {
    return NextResponse.json({ ok: true }); // 2xx fast-ack even on ignored events
  }

  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "evolution"),
        sql`${integrations.credentials}->>'instanceName' = ${inbound.instanceName}`
      )
    );
  if (!integration) {
    console.error(`[evolution webhook] no tenant wired to instance '${inbound.instanceName}'`);
    return NextResponse.json({ ok: true });
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, integration.tenantId));
  if (!tenant) return NextResponse.json({ ok: true });

  const waHash = crypto.createHash("sha256").update(inbound.from).digest("hex");
  let [customer] = await db.select().from(customers).where(eq(customers.whatsappNumberHash, waHash));
  if (!customer) {
    [customer] = await db.insert(customers).values({ tenantId: tenant.id, whatsappNumberHash: waHash }).returning();
  }

  const ctx: TenantContext = { tenantId: tenant.id, userId: "system:whatsapp", role: "agent" };
  const conversation = await getOrCreateConversation(ctx, "whatsapp", customer.id);

  const result = await converse(ctx, tenant, conversation.id, inbound.text);
  const finalText = await result.text;
  const creds = integration.credentials as { apiUrl?: string; apiKey?: string } | null;
  await sendText(inbound.instanceName, inbound.from, finalText, { apiUrl: creds?.apiUrl, apiKey: creds?.apiKey });

  return NextResponse.json({ ok: true });
}
