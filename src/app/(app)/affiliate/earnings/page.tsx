"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ───

interface Commission {
  id: string;
  type: "DIRECT" | "OVERRIDE";
  amount: number;
  status: "PENDING" | "APPROVED" | "PAID" | "CLAWED_BACK";
  month: number | null;
  planName: string | null;
  createdAt: string;
  referredUser?: { name: string | null; email: string } | null;
}

interface PayoutRequest {
  id: string;
  amount: number;
  method: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
}

interface Stats {
  approvedEarnings: number;
  pendingEarnings: number;
}

interface PayoutMethod {
  method: string | null;
}

// ─── Helpers ───

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  APPROVED: "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] border-[var(--accent-amber)]/20",
  PAID: "bg-[rgba(74,222,128,0.1)] text-[var(--success)] border-[var(--success)]/20",
  CLAWED_BACK: "bg-[rgba(239,68,68,0.1)] text-[var(--error)] border-[var(--error)]/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

// ─── Main Page ───

export default function EarningsPage() {
  const [activeTab, setActiveTab] = useState<"commissions" | "payouts">("commissions");

  // Commission state
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commTotal, setCommTotal] = useState(0);
  const [commPages, setCommPages] = useState(1);
  const [commPage, setCommPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingComm, setLoadingComm] = useState(true);

  // Payout state
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  // Affiliate state
  const [stats, setStats] = useState<Stats | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Load affiliate info
  useEffect(() => {
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setStats(d.stats);
        if (d.affiliate) {
          setPayoutMethod({ method: d.affiliate.payoutMethod ?? null });
        }
      })
      .catch(() => {});
  }, []);

  // Load commissions
  const loadCommissions = useCallback(() => {
    setLoadingComm(true);
    const params = new URLSearchParams({
      page: String(commPage),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    fetch(`/api/affiliate/commissions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setCommissions(d.commissions ?? []);
        setCommTotal(d.total ?? 0);
        setCommPages(d.pages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoadingComm(false));
  }, [commPage, statusFilter]);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  // Load payouts
  useEffect(() => {
    if (activeTab !== "payouts") return;
    setLoadingPayouts(true);
    fetch("/api/affiliate/payouts")
      .then((r) => r.json())
      .then((d) => setPayouts(d.payouts ?? []))
      .catch(() => {})
      .finally(() => setLoadingPayouts(false));
  }, [activeTab]);

  const handlePayoutRequest = async () => {
    setRequestingPayout(true);
    setPayoutError(null);
    try {
      const res = await fetch("/api/affiliate/payout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPayoutSuccess(true);
      // Refresh stats
      const me = await fetch("/api/affiliate/me").then((r) => r.json());
      if (me.stats) setStats(me.stats);
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRequestingPayout(false);
    }
  };

  const available = stats?.approvedEarnings ?? 0;
  const canWithdraw = available >= 50;
  const hasPayoutMethod = !!payoutMethod?.method;
  const progressToMin = Math.min((available / 50) * 100, 100);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Earnings
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Commission history and payouts
          </p>
        </div>
        <Link
          href="/affiliate"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 w-fit">
        {(["commissions", "payouts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-[var(--radius-md)] px-5 py-2 text-sm font-medium capitalize transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              activeTab === tab
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Commissions Tab */}
      {activeTab === "commissions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCommPage(1);
                }}
                className="h-9 appearance-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] pl-3.5 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="CLAWED_BACK">Clawed back</option>
              </select>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {commTotal} commission{commTotal !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {loadingComm ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-amber)]" />
              </div>
            ) : commissions.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-[var(--text-muted)]">No commissions found.</p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-[var(--border-subtle)] px-5 py-3">
                  {["Subscriber", "Plan", "Month", "Amount", "Status"].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {/* Rows */}
                <div className="divide-y divide-[var(--border-subtle)]">
                  {commissions.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-[var(--bg-elevated)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">
                          {c.referredUser?.name ?? c.referredUser?.email ?? "—"}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {c.type === "OVERRIDE" && (
                            <span className="ml-2 text-[var(--accent-amber)]">override</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[var(--text-secondary)]">
                        {c.planName ?? "—"}
                      </span>
                      <span className="text-center text-[var(--text-muted)]">
                        {c.month != null ? `${c.month}/12` : "—"}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">
                        ${c.amount.toFixed(2)}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {commPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCommPage((p) => Math.max(1, p - 1))}
                disabled={commPage <= 1}
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Page {commPage} of {commPages}
              </span>
              <button
                onClick={() => setCommPage((p) => Math.min(commPages, p + 1))}
                disabled={commPage >= commPages}
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          {loadingPayouts ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-amber)]" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 text-center">
              <p className="text-sm text-[var(--text-muted)]">No payouts yet.</p>
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="grid grid-cols-[auto_auto_auto_auto] gap-4 border-b border-[var(--border-subtle)] px-5 py-3">
                {["Requested", "Amount", "Method", "Status"].map((h) => (
                  <span
                    key={h}
                    className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {new Date(p.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      ${p.amount.toFixed(2)}
                    </span>
                    <span className="capitalize text-[var(--text-muted)]">
                      {p.method.toLowerCase()}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payout Request Panel */}
      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Request Payout
        </h2>

        <div className="mb-5 flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold ${
              canWithdraw ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"
            }`}
          >
            ${available.toFixed(2)}
          </span>
          <span className="text-sm text-[var(--text-muted)]">available</span>
        </div>

        {!canWithdraw && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                Minimum $50 required
              </span>
              <span className="text-[var(--text-muted)]">
                ${(50 - available).toFixed(2)} to go
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--accent-amber)] transition-all duration-500"
                style={{ width: `${progressToMin}%` }}
              />
            </div>
          </div>
        )}

        {canWithdraw && !hasPayoutMethod && (
          <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">
              You need to set up a payout method before withdrawing.
            </p>
            <Link
              href="/affiliate/settings"
              className="mt-2 inline-block text-sm font-medium text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]"
            >
              Set up payout method &rarr;
            </Link>
          </div>
        )}

        {payoutSuccess && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--success)]/20 bg-[var(--success)]/5 px-4 py-3">
            <p className="text-sm text-[var(--success)]">
              Payout requested successfully. You&apos;ll receive your funds within
              3–5 business days.
            </p>
          </div>
        )}

        {payoutError && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3">
            <p className="text-sm text-[var(--error)]">{payoutError}</p>
          </div>
        )}

        <button
          onClick={handlePayoutRequest}
          disabled={!canWithdraw || !hasPayoutMethod || requestingPayout || payoutSuccess}
          className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
        >
          {requestingPayout ? "Requesting..." : `Request Payout — $${available.toFixed(2)}`}
        </button>

        <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
          Commissions are held for 30 days (NET-30) to cover potential refunds.
          Approved earnings are paid within 3–5 business days of your request.
        </p>
      </div>
    </div>
  );
}
