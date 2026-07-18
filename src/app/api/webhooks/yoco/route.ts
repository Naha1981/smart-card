import { NextRequest, NextResponse } from "next/server";
import { orders } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/integrations/yoco/client";
import { confirmPayment } from "@/modules/orders/service";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("webhook-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);
  if (event.type !== "payment.succeeded") return NextResponse.json({ ok: true });

  const orderId = event.payload?.metadata?.orderId;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  await confirmPayment({ tenantId: order.tenantId, userId: "system:yoco", role: "agent" }, orderId, event.payload.id);
  return NextResponse.json({ ok: true });
}
