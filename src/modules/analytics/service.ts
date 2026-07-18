import { db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { scoped, type TenantContext } from "@/lib/db/tenant-scope";
import { eq } from "drizzle-orm";

/**
 * STUB. PRD §7 merchandising insights: top intents, missed-sale demand
 * (searches with no SKU match), accepted substitutions, promo effectiveness.
 * Reads off the events table — all of these are derivable from
 * MessageReceived / CartBuilt / SubstitutionAccepted events once volume
 * exists to make aggregation meaningful.
 */
export async function getMissedSales(ctx: TenantContext) {
  const rows = await db.select().from(events).where(scoped(events, ctx, eq(events.type, "MessageReceived")));
  // TODO: join against searchProducts misses once search logging is added.
  return { count: 0, examples: [], note: "Not yet implemented — needs search-miss logging." };
}
