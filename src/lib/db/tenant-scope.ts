/**
 * Every data access in SmartCart must go through a TenantContext.
 * This is the single enforcement point for §4 (Multi-Tenancy Standard):
 * a leaked cross-tenant query is a Sev-1. Route Handlers and Server Actions
 * resolve a TenantContext from the authenticated session BEFORE calling any
 * module service — never trust a tenantId passed from the client.
 */
import { eq, and, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "analyst" | "agent";
}

/** Merge a caller-supplied filter with a mandatory tenant_id predicate. */
export function scoped<T extends PgTable & { tenantId: unknown }>(
  table: T,
  ctx: TenantContext,
  extra?: SQL
): SQL {
  // @ts-expect-error — tenantId column presence is enforced by the generic constraint
  const tenantPredicate = eq(table.tenantId, ctx.tenantId);
  return extra ? and(tenantPredicate, extra)! : tenantPredicate;
}

/** Throws if a role isn't permitted — call at the top of every mutating service function. */
export function requireRole(ctx: TenantContext, allowed: TenantContext["role"][]) {
  if (!allowed.includes(ctx.role)) {
    throw new Error(`Forbidden: role '${ctx.role}' cannot perform this action`);
  }
}

/**
 * ESLint custom rule placeholder: in the real repo, add a `no-restricted-syntax`
 * rule blocking `db.select().from(<tenantTable>)` calls that don't pass through
 * `scoped()`, enforced in CI per Architecture Standard §9 (CI gates).
 */
