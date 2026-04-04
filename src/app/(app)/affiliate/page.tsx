import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CopyFieldClient } from "./copy-field-client";

interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  activeReferrals: number;
  pendingEarnings: number;
  approvedEarnings: number;
  paidEarnings: number;
  totalEarnings: number;
}

interface Commission {
  id: string;
  type: string;
  amount: number;
  status: string;
  month: number | null;
  createdAt: string;
  referredUser?: { name: string | null; email: string };
  planName?: string | null;
}

interface AffiliateData {
  id: string;
  code: string;
  tier: string;
  status: string;
  payoutMethod: string | null;
  paypalEmail: string | null;
  stripeAccountId: string | null;
}

async function getAffiliateData(cookie: string): Promise<{
  affiliate: AffiliateData;
  stats: AffiliateStats;
} | null> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/affiliate/me`,
      {
        headers: { cookie },
        cache: "no-store",
      }
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getRecentCommissions(cookie: string): Promise<Commission[]> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/affiliate/commissions?page=1`,
      {
        headers: { cookie },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.commissions ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:
      "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
    APPROVED:
      "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] border-[var(--accent-amber)]/20",
    PAID: "bg-[rgba(74,222,128,0.1)] text-[var(--success)] border-[var(--success)]/20",
    CLAWED_BACK:
      "bg-[rgba(239,68,68,0.1)] text-[var(--error)] border-[var(--error)]/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.PENDING}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

// ─── Apply CTA ───

function ApplyCTA() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-8">
        <div className="absolute -inset-6 rounded-full bg-[var(--accent-amber)] opacity-[0.04] blur-[48px]" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/30 bg-[var(--bg-surface)]">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--accent-amber)]"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m-12.1 12 .7-.7m11.4.7-.7-.7" />
          </svg>
        </div>
      </div>

      <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Earn with Artifacial
      </h2>
      <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-[var(--text-secondary)]">
        Refer creators to Artifacial and earn{" "}
        <span className="text-[var(--accent-amber)]">20% of every subscription</span>{" "}
        for a full 12 months. No cap, no fuss.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Commission", value: "20%", sub: "per referral" },
          { label: "Duration", value: "12 mo", sub: "per subscriber" },
          { label: "Payout", value: "NET-30", sub: "monthly" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-5 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {item.label}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-[var(--accent-amber)]">
              {item.value}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.sub}</p>
          </div>
        ))}
      </div>

      <Link
        href="/apply"
        className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-3.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_32px_rgba(232,166,52,0.15)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)]"
      >
        Apply to Become an Affiliate
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Dashboard ───

export default async function AffiliatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  // Pass session cookie to internal API
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [data, recentCommissions] = await Promise.all([
    getAffiliateData(cookieHeader),
    getAffiliateData(cookieHeader).then((d) =>
      d ? getRecentCommissions(cookieHeader) : []
    ),
  ]);

  if (!data) {
    return (
      <div>
        <div className="mb-10">
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Affiliate Program
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Earn commissions by referring creators to Artifacial
          </p>
        </div>
        <ApplyCTA />
      </div>
    );
  }

  const { affiliate, stats } = data;
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://artifacial.ai"}/?ref=${affiliate.code}`;
  const canWithdraw = stats.approvedEarnings >= 50;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Affiliate Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Code:{" "}
            <span className="font-semibold text-[var(--accent-amber)]">
              {affiliate.code}
            </span>
            {affiliate.tier === "AGENT" && (
              <span className="ml-3 inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
                Agent
              </span>
            )}
          </p>
        </div>
        <Link
          href="/affiliate/earnings"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          View Full History
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Total Clicks
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            {stats.totalClicks.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {stats.totalConversions} converted
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Active Referrals
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            {stats.activeReferrals}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            paying subscribers
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Pending Earnings
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            ${stats.pendingEarnings.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">NET-30 hold</p>
        </div>

        <div
          className={`rounded-[var(--radius-lg)] border p-5 transition-all duration-300 ${
            canWithdraw
              ? "border-[var(--accent-amber)]/30 bg-[var(--bg-surface)] shadow-[0_0_24px_rgba(232,166,52,0.06)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Available to Withdraw
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold ${
              canWithdraw
                ? "text-[var(--accent-amber)]"
                : "text-[var(--text-primary)]"
            }`}
          >
            ${stats.approvedEarnings.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {canWithdraw ? (
              <Link
                href="/affiliate/earnings"
                className="text-[var(--accent-amber)] hover:underline"
              >
                Request payout
              </Link>
            ) : (
              `$${(50 - stats.approvedEarnings).toFixed(2)} until minimum`
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Your Tools */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Your Tools
            </h2>

            <div className="space-y-4">
              {/* Promo Code */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  Promo Code
                </p>
                <CopyFieldClient value={affiliate.code} label="code" mono />
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                  Share this code and subscribers who use it at checkout will be
                  attributed to you.
                </p>
              </div>

              {/* Referral Link */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  Referral Link
                </p>
                <CopyFieldClient value={referralLink} label="link" />
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                  Link directly to Artifacial with your affiliate tag. Perfect
                  for bios and posts.
                </p>
              </div>
            </div>
          </div>

          {/* Commission Structure */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Commission Structure
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--accent-amber)]"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Earn{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    20% of every subscription payment
                  </span>{" "}
                  for 12 months from sign-up
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--accent-amber)]"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Commissions held{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    30 days (NET-30)
                  </span>{" "}
                  to cover refunds, then approved
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--accent-amber)]"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Minimum payout{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    $50
                  </span>{" "}
                  via PayPal or Stripe
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Agent Panel */}
          {affiliate.tier === "AGENT" && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--accent-amber)]/20 bg-[var(--bg-surface)] p-5 shadow-[0_0_32px_rgba(232,166,52,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Agent Program
                </h2>
                <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
                  Active
                </span>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                As an Agent, you earn{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  10% of your sub-affiliates&apos; commissions
                </span>{" "}
                forever — no time limit, no cap.
              </p>
              <Link
                href="/agency"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)]"
              >
                Manage Your Affiliates
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          {/* Recent Activity */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Activity
              </h2>
              <Link
                href="/affiliate/earnings"
                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-amber)]"
              >
                View all
              </Link>
            </div>

            {recentCommissions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No commissions yet. Share your link to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentCommissions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      <span className="text-[var(--text-secondary)]">
                        {c.type === "OVERRIDE"
                          ? "Override"
                          : c.planName ?? "Referral"}
                        {c.month != null && (
                          <span className="ml-1 text-[10px] text-[var(--text-muted)]">
                            mo.{c.month}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        ${c.amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(c.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payout Settings shortcut */}
          {!affiliate.payoutMethod && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--text-muted)]"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Set up your payout method
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Required before you can withdraw earnings
                  </p>
                </div>
                <Link
                  href="/affiliate/settings"
                  className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Configure
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
