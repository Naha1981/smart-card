import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tenants, memberships } from "@/lib/db/schema";
import { emit } from "@/lib/events/bus";

export async function registerTenant(input: {
  name: string;
  slug: string;
  industry: string;
  country?: string;
  ownerUserId: string;
}) {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.name,
      slug: input.slug,
      industry: input.industry,
      country: input.country ?? "ZA",
      status: "sandbox",
    })
    .returning();

  await db.insert(memberships).values({ tenantId: tenant.id, userId: input.ownerUserId, role: "owner" });
  await emit({ tenantId: tenant.id }, "TenantOnboarded", { slug: tenant.slug });
  return tenant;
}

export async function setPersonality(
  tenantId: string,
  personality: { preset: string; customInstructions?: string; guardrails?: string[] }
) {
  await db.update(tenants).set({ aiPersonality: personality as any }).where(eq(tenants.id, tenantId));
}

export async function goLive(tenantId: string) {
  await db.update(tenants).set({ status: "live" }).where(eq(tenants.id, tenantId));
}

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  return tenant ?? null;
}
