import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant-scope";

/**
 * STUB. Queues an outbound notification (order confirmations, cart recovery
 * nudges, delivery updates). Dispatch worker not yet built — wire to
 * lib/integrations/evolution or a Resend/SES client per channel.
 */
export async function queueNotification(
  ctx: TenantContext,
  input: { customerId: string; channel: "whatsapp" | "email"; payload: Record<string, unknown> }
) {
  const [row] = await db
    .insert(notifications)
    .values({ tenantId: ctx.tenantId, customerId: input.customerId, channel: input.channel, payload: input.payload })
    .returning();
  return row;
}
