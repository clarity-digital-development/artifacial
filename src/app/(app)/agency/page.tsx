"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ───

interface SubAffiliate {
  id: string;
  code: string;
  status: string;
  user: { name: string | null; email: string };
  stats: {
    activeReferrals: number;
    totalEarnings: number;
  };
  overrideEarnings: number;
}

// ─── Helpers ───

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  ACTIVE: "bg-[rgba(74,222,128,0.1)] text-[var(--success)] border-[var(--success)]/20",
  SUSPENDED: "bg-[rgba(239,68,68,0.1)] text-[var(--error)] border-[var(--error)]/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Page ───

export default function AgencyPage() {
  const [affiliates, setAffiliates] = useState<SubAffiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loadAffiliates = useCallback(() => {
    setLoading(true);
    fetch("/api/agency/affiliates")
      .then((r) => r.json())
      .then((d) => setAffiliates(d.affiliates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/agency/invite", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setInviteUrl(data.inviteUrl);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {}
  };

  // Aggregate stats
  const totalAffiliates = affiliates.length;
  const activeAffiliates = affiliates.filter((a) => a.status === "ACTIVE").length;
  const totalOverride = affiliates.reduce((s, a) => s + (a.overrideEarnings ?? 0), 0);
  // "This month" would ideally come from API — using total as placeholder if not available
  const overrideThisMonth = affiliates.reduce(
    (s, a) => s + (a.overrideEarnings ?? 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Agency Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Manage your affiliate network and track override earnings
          </p>
        </div>
        <Link
          href="/affiliate"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          My Affiliate Dashboard
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Total Sub-Affiliates
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            {totalAffiliates}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">all time</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Active Sub-Affiliates
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            {activeAffiliates}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">currently active</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Override Earnings
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--accent-amber)]">
            ${overrideThisMonth.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">current period</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Total Override Earnings
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">
            ${totalOverride.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">all time</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--accent-amber)]/20 bg-[var(--bg-surface)] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent-amber)]"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              You earn 10% of your affiliates&apos; commissions — forever
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Every time one of your sub-affiliates earns a commission, you
              automatically receive a 10% override. No time limit, no cap.
              Override earnings follow the same NET-30 hold as direct
              commissions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sub-affiliates Table */}
        <div className="lg:col-span-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Your Affiliates
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-amber)]" />
              </div>
            ) : affiliates.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No affiliates yet. Generate an invite link to get started.
                </p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-[var(--border-subtle)] px-5 py-3">
                  {["Affiliate", "Code", "Referrals", "Their Earnings", "Your Override"].map(
                    (h) => (
                      <span
                        key={h}
                        className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        {h}
                      </span>
                    )
                  )}
                </div>
                {/* Rows */}
                <div className="divide-y divide-[var(--border-subtle)]">
                  {affiliates.map((a) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-[var(--bg-elevated)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text-primary)]">
                          {a.user.name ?? a.user.email}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {a.user.name ? a.user.email : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {a.code}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      <span className="text-center text-[var(--text-secondary)]">
                        {a.stats?.activeReferrals ?? 0}
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        ${(a.stats?.totalEarnings ?? 0).toFixed(2)}
                      </span>
                      <span className="font-medium text-[var(--accent-amber)]">
                        ${(a.overrideEarnings ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right — Invite Panel */}
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Invite New Affiliate
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Generate a unique invite link to bring new affiliates into your
              network. They apply through your link and are automatically
              attributed to you.
            </p>

            {inviteError && (
              <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2.5">
                <p className="text-xs text-[var(--error)]">{inviteError}</p>
              </div>
            )}

            {inviteUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
                    {inviteUrl}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyInvite}
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {copiedInvite ? (
                      <span className="text-[var(--success)]">Copied!</span>
                    ) : (
                      "Copy Link"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setInviteUrl(null);
                      handleGenerateInvite();
                    }}
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    New Link
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  This link is single-use and expires in 72 hours.
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
              >
                {inviteLoading ? "Generating..." : "Generate Invite Link"}
              </button>
            )}
          </div>

          {/* Quick stats summary */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Network Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Total referrals across network</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {affiliates.reduce((s, a) => s + (a.stats?.activeReferrals ?? 0), 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Network total earnings</span>
                <span className="font-medium text-[var(--text-primary)]">
                  ${affiliates.reduce((s, a) => s + (a.stats?.totalEarnings ?? 0), 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Your total overrides</span>
                <span className="font-medium text-[var(--accent-amber)]">
                  ${totalOverride.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
