import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { scoped, type TenantContext } from "@/lib/db/tenant-scope";

/**
 * F13 — deterministic attribution. An order counts as AI-influenced when the
 * AI built the basket, recommended an item that was purchased, or recovered
 * an abandoned cart (see orders.attributionType, set at write time in
 * modules/orders/service.ts — never inferred after the fact).
 */
export async function getExecutiveSummary(ctx: TenantContext, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      aiInfluenced: orders.aiInfluenced,
      total: orders.total,
    })
    .from(orders)
    .where(scoped(orders, ctx, and(eq(orders.status, "paid"), gte(orders.createdAt, since))));

  const aiOrders = rows.filter((r) => r.aiInfluenced);
  const nonAiOrders = rows.filter((r) => !r.aiInfluenced);

  const aiRevenue = aiOrders.reduce((s, r) => s + Number(r.total), 0);
  const aiAvgBasket = aiOrders.length ? aiRevenue / aiOrders.length : 0;
  const nonAiAvgBasket = nonAiOrders.length
    ? nonAiOrders.reduce((s, r) => s + Number(r.total), 0) / nonAiOrders.length
    : 0;
  const basketUpliftPct = nonAiAvgBasket ? ((aiAvgBasket - nonAiAvgBasket) / nonAiAvgBasket) * 100 : 0;

  return {
    windowDays: sinceDays,
    ordersInfluenced: aiOrders.length,
    aiAssistedRevenue: Number(aiRevenue.toFixed(2)),
    basketUpliftPct: Number(basketUpliftPct.toFixed(1)),
  };
}
