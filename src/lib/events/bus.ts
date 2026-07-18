import { db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant-scope";

export type DomainEventType =
  | "MessageReceived"
  | "CartBuilt"
  | "SubstitutionAccepted"
  | "OrderPlaced"
  | "PaymentConfirmed"
  | "CatalogSynced"
  | "TenantOnboarded"
  | "HumanEscalated"
  | "WorkflowCompleted";

/**
 * Emit a domain event. This is the single write path that powers attribution,
 * analytics, AI memory, notifications, and audit trails (§6). Never write
 * directly to the events table from a module — always go through emit().
 */
export async function emit(
  ctx: Pick<TenantContext, "tenantId">,
  type: DomainEventType,
  payload: Record<string, unknown>
) {
  await db.insert(events).values({
    tenantId: ctx.tenantId,
    type,
    payload,
  });
}
