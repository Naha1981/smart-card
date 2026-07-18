import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./config";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant-scope";

/**
 * Resolve a TenantContext for the current request. Route Handlers and
 * Server Actions must call this before invoking any module service —
 * never accept a tenantId from the request body or query string.
 */
export async function resolveTenantContext(requestedTenantId: string): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, session.user.id), eq(memberships.tenantId, requestedTenantId)));

  if (!membership) throw new Error("Forbidden: no membership for this tenant");

  return {
    tenantId: membership.tenantId,
    userId: session.user.id,
    role: membership.role as TenantContext["role"],
  };
}
