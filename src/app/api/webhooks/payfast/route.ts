import { NextRequest, NextResponse } from "next/server";
import { orders } from "@/lib/db/schema";
import { db as dbClient } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { validateItn } from "@/lib/integrations/payfast/client";
import { confirmPayment } from "@/modules/orders/service";

/**
 * PayFast ITN handler. Browser return_url redirects are NEVER trusted for
 * order state — only a fully validated ITN posted here confirms payment
 * (Architecture Standard §5).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const payload = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  const sourceIp = req.headers.get("x-forwarded-for") ?? "";

  const isValid = await validateItn(payload, sourceIp);
  if (!isValid) {
    return NextResponse.json({ error: "invalid ITN" }, { status: 400 });
  }

  const orderId = payload.m_payment_id;
  const [order] = await dbClient.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  // Verify the paid amount matches the order total before confirming.
  if (Number(payload.amount_gross) < Number(order.total)) {
    return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
  }

  await confirmPayment({ tenantId: order.tenantId, userId: "system:payfast", role: "agent" }, orderId, payload.pf_payment_id);
  return NextResponse.json({ ok: true });
}
