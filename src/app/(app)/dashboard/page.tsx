import { getExecutiveSummary } from "@/modules/attribution/service";
import { resolveTenantContext } from "@/lib/auth/tenant-context";

/**
 * Executive/ROI view — the product execs renew on (PRD §7). Server Component:
 * reads go straight through the module service, no client round-trip.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const { tenant: tenantId } = await searchParams;
  if (!tenantId) {
    return <EmptyState />;
  }

  const ctx = await resolveTenantContext(tenantId);
  const summary = await getExecutiveSummary(ctx, 30);

  return (
    <main className="min-h-screen bg-bg p-10">
      <h1 className="text-2xl font-semibold text-text mb-1">Last 30 days</h1>
      <p className="text-text-dim mb-8">Your AI employee's performance, at a glance.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="AI-assisted revenue" value={`R${summary.aiAssistedRevenue.toLocaleString()}`} />
        <Metric label="Orders influenced" value={summary.ordersInfluenced.toLocaleString()} />
        <Metric label="Basket uplift" value={`${summary.basketUpliftPct}%`} accent />
        <Metric label="Window" value={`${summary.windowDays} days`} />
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-text-dim">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? "text-accent" : "text-text"}`}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg">
      <p className="text-text-dim">No tenant selected. Append ?tenant=&lt;tenantId&gt; while onboarding is being wired up.</p>
    </main>
  );
}
