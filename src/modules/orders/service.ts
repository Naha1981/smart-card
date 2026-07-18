import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, orderItems, products, customers } from "@/lib/db/schema";
import { scoped, type TenantContext } from "@/lib/db/tenant-scope";
import { emit } from "@/lib/events/bus";
import { createCheckoutLink } from "@/lib/integrations/payments";

/**
 * In-memory representation of an active cart keyed by conversationId.
 * Phase 2 note: promote to a `carts`/`cart_items` table once cart recovery
 * nudges and multi-session persistence are needed — MVP keeps it on the
 * order row in `pending` status per Architecture Standard §11 (extract only
 * when metrics prove it necessary).
 */
export async function buildCart(
  ctx: TenantContext,
  conversationId: string,
  items: Array<{ productId: string; quantity: number }>
) {
  const rows = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(scoped(products, ctx));
  const priceMap = new Map(rows.map((r) => [r.id, Number(r.price)]));

  const total = items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);

  const [order] = await db
    .insert(orders)
    .values({
      tenantId: ctx.tenantId,
      conversationId,
      status: "pending",
      total: total.toFixed(2),
      aiInfluenced: true,
      attributionType: "ai_built_basket",
    })
    .returning();

  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: (priceMap.get(item.productId) ?? 0).toFixed(2),
    }))
  );

  await emit(ctx, "CartBuilt", { orderId: order.id, itemCount: items.length, total });
  return { cartId: order.id, total, currency: "ZAR" };
}

export async function applyLoyalty(ctx: TenantContext, customerId: string, cartId: string) {
  const [customer] = await db.select().from(customers).where(scoped(customers, ctx, eq(customers.id, customerId)));
  if (!customer) throw new Error("Customer not found");

  const [order] = await db.select().from(orders).where(scoped(orders, ctx, eq(orders.id, cartId)));
  if (!order) throw new Error("Cart not found");

  const discount = Math.min(Number(customer.loyaltyBalance), Number(order.total) * 0.5);
  const newTotal = (Number(order.total) - discount).toFixed(2);
  await db.update(orders).set({ total: newTotal }).where(eq(orders.id, cartId));

  return { appliedDiscount: discount, newTotal };
}

export async function createCheckout(ctx: TenantContext, cartId: string) {
  const [order] = await db.select().from(orders).where(scoped(orders, ctx, eq(orders.id, cartId)));
  if (!order) throw new Error("Cart not found");

  const checkout = await createCheckoutLink({
    orderId: order.id,
    amount: Number(order.total),
    currency: order.currency,
  });

  await db.update(orders).set({ paymentProvider: checkout.provider, paymentRef: checkout.reference }).where(eq(orders.id, cartId));
  return checkout;
}

export async function getOrderStatus(ctx: TenantContext, orderId: string) {
  const [order] = await db
    .select({ id: orders.id, status: orders.status, total: orders.total, currency: orders.currency })
    .from(orders)
    .where(scoped(orders, ctx, eq(orders.id, orderId)));
  if (!order) throw new Error("Order not found");
  return order;
}

export async function confirmPayment(ctx: TenantContext, orderId: string, paymentRef: string) {
  await db.update(orders).set({ status: "paid", paymentRef }).where(eq(orders.id, orderId));
  await emit(ctx, "PaymentConfirmed", { orderId, paymentRef });
}
