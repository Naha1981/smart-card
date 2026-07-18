import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { integrations, tenants } from "@/lib/db/schema";
import { setWebhook } from "@/lib/integrations/evolution/client";

/**
 * ONE-OFF SETUP ROUTE — not part of the product surface.
 *
 * Registers a tenant's Evolution instance webhook once you have a public
 * URL (ngrok tunnel or a real Vercel deployment). Run once per tenant per
 * time the public URL changes (e.g. every new ngrok session).
 *
 * Protected by ADMIN_SETUP_SECRET — set it in .env.local before calling
 * this, and consider deleting this route entirely once WhatsApp go-live is
 * done and you no longer need to re-register webhooks by hand.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/admin/setup-evolution-webhook \
 *     -H "Content-Type: application/json" \
 *     -H "x-admin-secret: <ADMIN_SETUP_SECRET>" \
 *     -d '{"tenantSlug":"naha-fresh","publicWebhookUrl":"https://your-ngrok-id.ngrok-free.app/api/webhooks/evolution"}'
 */
const bodySchema = z.object({
  tenantSlug: z.string(),
  publicWebhookUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (!process.env.ADMIN_SETUP_SECRET || adminSecret !== process.env.ADMIN_SETUP_SECRET) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Missing or wrong x-admin-secret header" } }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: parsed.error.message } }, { status: 400 });
  }
  const { tenantSlug, publicWebhookUrl } = parsed.data;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug));
  if (!tenant) {
    return NextResponse.json({ error: { code: "not_found", message: `No tenant with slug '${tenantSlug}'` } }, { status: 404 });
  }

  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenant.id), eq(integrations.provider, "evolution")));
  if (!integration) {
    return NextResponse.json(
      { error: { code: "not_found", message: `No Evolution integration row for tenant '${tenantSlug}' — run drizzle/0002_seed_evolution_integration.sql first` } },
      { status: 404 }
    );
  }

  const creds = integration.credentials as { instanceName: string; apiUrl: string; apiKey: string };

  try {
    const result = await setWebhook(creds.instanceName, publicWebhookUrl, { apiUrl: creds.apiUrl, apiKey: creds.apiKey });
    return NextResponse.json({ ok: true, instanceName: creds.instanceName, webhookUrl: publicWebhookUrl, evolutionResponse: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "evolution_error", message: err instanceof Error ? err.message : "Unknown error calling Evolution API" } },
      { status: 502 }
    );
  }
}
