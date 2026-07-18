import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext } from "@/lib/auth/tenant-context";
import { importCsvBatch } from "@/modules/products/service";
import { emit } from "@/lib/events/bus";

const rowSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.string(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
const bodySchema = z.object({ tenantId: z.string(), rows: z.array(rowSchema).max(5000) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: parsed.error.message } }, { status: 400 });
  }

  const ctx = await resolveTenantContext(parsed.data.tenantId);
  const result = await importCsvBatch(ctx, parsed.data.rows);
  await emit(ctx, "CatalogSynced", { source: "csv", count: result.imported });

  return NextResponse.json(result);
}
