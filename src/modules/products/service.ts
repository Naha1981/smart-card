import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { products, inventory, promotions } from "@/lib/db/schema";
import { scoped, type TenantContext } from "@/lib/db/tenant-scope";
import { embedText } from "@/lib/ai/embeddings";

/**
 * Hybrid search per Architecture Standard §6: Postgres FTS + filters first,
 * pgvector semantic search layered in, AI re-ranking reserved for Phase 2.
 */
export async function searchProducts(ctx: TenantContext, query: string, limit = 10) {
  const textMatches = await db
    .select()
    .from(products)
    .where(scoped(products, ctx, ilike(products.name, `%${query}%`)))
    .limit(limit);

  if (textMatches.length >= limit) return textMatches;

  // Fall back to semantic search to fill remaining slots.
  const embedding = await embedText(query);
  const semanticMatches = await db
    .select()
    .from(products)
    .where(scoped(products, ctx))
    .orderBy(sql`${products.embedding} <-> ${JSON.stringify(embedding)}`)
    .limit(limit - textMatches.length);

  const seen = new Set(textMatches.map((p) => p.id));
  return [...textMatches, ...semanticMatches.filter((p) => !seen.has(p.id))];
}

export async function getPrice(ctx: TenantContext, productId: string) {
  const [product] = await db
    .select({ id: products.id, name: products.name, price: products.price, currency: products.currency })
    .from(products)
    .where(scoped(products, ctx, eq(products.id, productId)));
  if (!product) throw new Error(`Product ${productId} not found for tenant`);
  return product;
}

export async function checkStock(ctx: TenantContext, productId: string, storeId?: string) {
  const conditions = storeId ? and(eq(inventory.productId, productId), eq(inventory.storeId, storeId)) : eq(inventory.productId, productId);
  const [row] = await db
    .select({ quantity: inventory.quantity, inStock: inventory.inStock })
    .from(inventory)
    .where(scoped(inventory, ctx, conditions));
  return row ?? { quantity: 0, inStock: false };
}

export async function getActivePromotions(
  ctx: TenantContext,
  filter: { productId?: string; category?: string }
) {
  const now = new Date();
  const conditions = filter.productId ? eq(promotions.productId, filter.productId) : undefined;
  const rows = await db
    .select()
    .from(promotions)
    .where(scoped(promotions, ctx, conditions));
  return rows.filter((p) => p.startsAt <= now && p.endsAt >= now);
}

export async function importCsvBatch(
  ctx: TenantContext,
  rows: Array<{ sku: string; name: string; price: string; category?: string; imageUrl?: string }>
) {
  if (rows.length === 0) return { imported: 0 };
  await db
    .insert(products)
    .values(
      rows.map((r) => ({
        tenantId: ctx.tenantId,
        sku: r.sku,
        name: r.name,
        price: r.price,
        category: r.category,
        imageUrl: r.imageUrl,
        source: "csv" as const,
      }))
    )
    .onConflictDoNothing();
  return { imported: rows.length };
}
