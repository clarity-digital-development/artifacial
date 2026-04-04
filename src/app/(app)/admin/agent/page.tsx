import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Admin — Agents — Artifacial" };

async function getAgentOverview() {
  const agents = await prisma.affiliate.findMany({
    where: { tier: "AGENT" },
    include: {
      user: { select: { name: true, email: true } },
      subAffiliates: {
        include: {
          user: { select: { name: true, email: true } },
          commissions: {
            where: { type: "DIRECT" },
            select: { amount: true, status: true },
          },
        },
      },
      commissions: {
        where: { type: "OVERRIDE" },
        select: { amount: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return agents.map((agent) => {
    const overrideTotal = agent.commissions.reduce((s, c) => s + c.amount, 0);
    const overridePending = agent.commissions
      .filter((c) => c.status === "PENDING")
      .reduce((s, c) => s + c.amount, 0);

    const subAffiliateStats = agent.subAffiliates.map((sub) => {
      const directTotal = sub.commissions.reduce((s, c) => s + c.amount, 0);
      return {
        id: sub.id,
        code: sub.code,
        status: sub.status,
        user: sub.user,
        directTotal,
      };
    });

    return {
      id: agent.id,
      code: agent.code,
      status: agent.status,
      user: agent.user,
      createdAt: agent.createdAt,
      overrideTotal,
      overridePending,
      subAffiliates: subAffiliateStats,
    };
  });
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  ACTIVE: "bg-[rgba(74,222,128,0.1)] text-[var(--success)] border-[var(--success)]/20",
  SUSPENDED: "bg-[rgba(239,68,68,0.1)] text-[var(--error)] border-[var(--error)]/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default async function AdminAgentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) redirect("/studio");

  const agents = await getAgentOverview();

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "ACTIVE").length;
  const totalOverride = agents.reduce((s, a) => s + a.overrideTotal, 0);
  const totalSubAffiliates = agents.reduce((s, a) => s + a.subAffiliates.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Agent Network
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Platform-wide view of all agents and their affiliate networks
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Agents", value: totalAgents, sub: "all time" },
          { label: "Active Agents", value: activeAgents, sub: "currently active" },
          { label: "Sub-Affiliates", value: totalSubAffiliates, sub: "across all agents" },
          { label: "Override Payable", value: `$${totalOverride.toFixed(2)}`, sub: "all time", amber: true },
        ].map((card) => (
          <div key={card.label} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {card.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold ${card.amber ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"}`}>
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Agents Table */}
      {agents.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20 text-center">
          <p className="text-sm text-[var(--text-muted)]">No agents yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              {/* Agent header row */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {agent.user.name ?? agent.user.email}
                      </span>
                      <StatusBadge status={agent.status} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {agent.user.name ? agent.user.email : ""} · Code:{" "}
                      <span className="font-mono">{agent.code}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sub-affiliates</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{agent.subAffiliates.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Override Earnings</p>
                    <p className="text-sm font-medium text-[var(--accent-amber)]">${agent.overrideTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pending</p>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">${agent.overridePending.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Sub-affiliates */}
              {agent.subAffiliates.length === 0 ? (
                <div className="px-5 py-4 text-xs text-[var(--text-muted)]">No sub-affiliates yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {agent.subAffiliates.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 px-5 py-3 text-sm">
                      <div className="flex items-center gap-2 pl-4">
                        <span className="text-[var(--border-default)]">└</span>
                        <div>
                          <span className="text-[var(--text-secondary)]">
                            {sub.user.name ?? sub.user.email}
                          </span>
                          {sub.user.name && (
                            <span className="ml-1 text-xs text-[var(--text-muted)]">({sub.user.email})</span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-xs text-[var(--text-muted)]">{sub.code}</span>
                      <StatusBadge status={sub.status} />
                      <span className="text-xs text-[var(--text-secondary)]">
                        ${sub.directTotal.toFixed(2)} earned
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
