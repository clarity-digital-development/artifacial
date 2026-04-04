"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type PayoutTab = "paypal" | "stripe";

export default function AffiliateSettingsPage() {
  const [activeTab, setActiveTab] = useState<PayoutTab>("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentMethod, setCurrentMethod] = useState<{
    method: string | null;
    paypalEmail: string | null;
    stripeAccountId: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current payout settings
  useEffect(() => {
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.affiliate) {
          setCurrentMethod({
            method: d.affiliate.payoutMethod ?? null,
            paypalEmail: d.affiliate.paypalEmail ?? null,
            stripeAccountId: d.affiliate.stripeAccountId ?? null,
          });
          if (d.affiliate.paypalEmail) setPaypalEmail(d.affiliate.paypalEmail);
          if (d.affiliate.payoutMethod === "STRIPE") setActiveTab("stripe");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSavePayPal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/affiliate/payout-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "PAYPAL", paypalEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSaveSuccess(true);
      setCurrentMethod((prev) => ({
        ...prev!,
        method: "PAYPAL",
        paypalEmail,
      }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Payout Settings
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Configure how you receive your affiliate earnings
          </p>
        </div>
        <Link
          href="/affiliate"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Method Selector */}
        <div className="space-y-5">
          {/* Current method banner */}
          {!loading && currentMethod?.method && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--success)]/20 bg-[var(--success)]/5 px-4 py-3">
              <p className="text-sm text-[var(--success)]">
                <span className="font-semibold">Active payout method:</span>{" "}
                {currentMethod.method === "PAYPAL"
                  ? `PayPal — ${currentMethod.paypalEmail}`
                  : "Stripe Connect"}
              </p>
            </div>
          )}

          {/* Toggle */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Payout Method
            </h2>

            {/* Tab Toggle */}
            <div className="mb-5 flex gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
              {(["paypal", "stripe"] as PayoutTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-[var(--radius-md)] py-2 text-sm font-medium capitalize transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    activeTab === tab
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab === "paypal" ? "PayPal" : "Stripe Connect"}
                </button>
              ))}
            </div>

            {/* PayPal Form */}
            {activeTab === "paypal" && (
              <form onSubmit={handleSavePayPal} className="space-y-4">
                <div>
                  <label
                    htmlFor="paypal-email"
                    className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    PayPal Email Address
                  </label>
                  <input
                    id="paypal-email"
                    type="email"
                    required
                    value={paypalEmail}
                    onChange={(e) => {
                      setPaypalEmail(e.target.value);
                      setSaveSuccess(false);
                    }}
                    placeholder="you@paypal.com"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    Must be a valid PayPal account. Payments sent directly to
                    this address.
                  </p>
                </div>

                {saveSuccess && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--success)]/20 bg-[var(--success)]/5 px-4 py-2.5">
                    <p className="text-sm text-[var(--success)]">PayPal address saved.</p>
                  </div>
                )}

                {saveError && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-2.5">
                    <p className="text-sm text-[var(--error)]">{saveError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !paypalEmail}
                  className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save PayPal Address"}
                </button>
              </form>
            )}

            {/* Stripe Connect */}
            {activeTab === "stripe" && (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#635BFF]/10">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-[#635BFF]"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                          fill="currentColor"
                          opacity="0.2"
                        />
                        <path d="M7 10.5c0-1.38 1.12-2.5 2.5-2.5h5c1.38 0 2.5 1.12 2.5 2.5v3c0 1.38-1.12 2.5-2.5 2.5h-5C8.12 16 7 14.88 7 13.5v-3z" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Stripe Connect
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Receive payouts directly to your bank account
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)] px-4 py-3">
                  <p className="text-sm text-[var(--accent-amber)]">
                    <span className="font-semibold">Coming soon.</span> Stripe
                    Connect onboarding will be available in the next release.
                    For now, please use PayPal.
                  </p>
                </div>

                <button
                  disabled
                  className="w-full cursor-not-allowed rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] opacity-40"
                >
                  Connect Stripe Account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right — Info Panel */}
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              How Payouts Work
            </h2>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Earn commissions",
                  desc: "You earn 20% of every subscription payment from referred users.",
                },
                {
                  step: "2",
                  title: "30-day hold (NET-30)",
                  desc: "Commissions are held for 30 days to account for refunds and chargebacks.",
                },
                {
                  step: "3",
                  title: "Request payout",
                  desc: "Once you have $50+ approved, request a payout from the Earnings page.",
                },
                {
                  step: "4",
                  title: "Receive funds",
                  desc: "Funds arrive within 3–5 business days via your chosen method.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)] text-[10px] font-bold text-[var(--accent-amber)]">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Payout Schedule
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Minimum threshold</span>
                <span className="font-medium text-[var(--text-primary)]">$50.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Hold period</span>
                <span className="font-medium text-[var(--text-primary)]">30 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Processing time</span>
                <span className="font-medium text-[var(--text-primary)]">3–5 business days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
