"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";

// ─── Types ───

interface Transaction {
  id: string;
  type: string;
  credits: number;
  description: string;
  createdAt: string;
}

interface BillingClientProps {
  tier: string;
  planName: string;
  subscriptionCredits: number;
  purchasedCredits: number;
  planCredits: number; // Monthly plan allocation for progress bar
  hasStripeCustomer: boolean;
  isFoundingMember: boolean;
  transactions: Transaction[];
}

const PLANS = [
  { key: "STARTER", name: "Starter", price: "$15", credits: 1500, baseCredits: 1000, bonusLabel: "+50% bonus" },
  { key: "CREATOR", name: "Creator", price: "$50", credits: 5000, baseCredits: 3500, bonusLabel: "+43% bonus" },
  { key: "PRO", name: "Pro", price: "$100", credits: 15000, baseCredits: 10000, bonusLabel: "+50% bonus" },
];

const CREDIT_PACKS = [
  { key: "credit_pack", name: "500 Credits", price: "$9.99" },
  { key: "credit_pack_plus", name: "1,250 Credits", price: "$24.99" },
];

// ─── Component ───

export function BillingClient({
  tier,
  planName,
  subscriptionCredits,
  purchasedCredits,
  planCredits,
  hasStripeCustomer,
  isFoundingMember,
  transactions,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalCredits = subscriptionCredits + purchasedCredits;

  const handleCheckout = async (type: "subscription" | "credit_pack", key: string) => {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      {error && (
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-[var(--text-sm)] text-red-400">{error}</p>
        </div>
      )}

      {/* Current Credits */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Credits
          </h2>
          {isFoundingMember && (
            <Badge variant="amber">Founding Member</Badge>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[var(--text-sm)]">
              <span className="text-[var(--text-secondary)]">Total Credits</span>
              <span className="font-medium text-[var(--accent-amber)]">
                {totalCredits.toLocaleString()}
              </span>
            </div>
            <ProgressBar
              progress={planCredits > 0 ? (Math.min(totalCredits, planCredits) / planCredits) * 100 : 0}
            />
          </div>
          <div className="flex items-center gap-6 text-[var(--text-xs)] text-[var(--text-muted)]">
            <span>
              Subscription: <span className="text-[var(--text-secondary)]">{subscriptionCredits.toLocaleString()}</span>
            </span>
            {purchasedCredits > 0 && (
              <span>
                Purchased: <span className="text-[var(--text-secondary)]">{purchasedCredits.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Plan
          </h2>
          {hasStripeCustomer && (
            <button
              onClick={handleManageBilling}
              disabled={loading === "portal"}
              className="text-[var(--text-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--accent-amber)]"
            >
              {loading === "portal" ? "Loading..." : "Manage billing"}
            </button>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="font-medium text-[var(--text-primary)]">
            {planName}
          </span>
          <Badge variant={tier === "FREE" ? "default" : "amber"}>
            {tier === "FREE" ? "Free" : "Active"}
          </Badge>
        </div>

        {tier === "FREE" ? (
          <p className="mb-5 text-[var(--text-sm)] text-[var(--text-secondary)]">
            100 credits one-time. Subscribe for monthly credits.
          </p>
        ) : (
          <p className="mb-5 text-[var(--text-sm)] text-[var(--text-secondary)]">
            {planCredits.toLocaleString()} credits per month, renewing with your subscription.
          </p>
        )}

        {tier === "FREE" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((p) => (
              <button
                key={p.key}
                onClick={() => handleCheckout("subscription", p.key)}
                disabled={loading === p.key}
                className="group rounded-[var(--radius-md)] border border-[var(--border-default)] p-4 text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--accent-amber)] hover:shadow-[0_0_24px_rgba(232,166,52,0.08)]"
              >
                <p className="font-medium text-[var(--text-primary)]">
                  {p.name}
                </p>
                <p className="mt-0.5 text-[var(--text-lg)] font-semibold text-[var(--accent-amber)]">
                  {p.price}
                  <span className="text-[var(--text-xs)] font-normal text-[var(--text-muted)]">
                    /mo
                  </span>
                </p>
                <p className="mt-2 text-[var(--text-xs)] text-[var(--text-muted)]">
                  <span className="line-through">{p.baseCredits.toLocaleString()}</span>
                  {" "}
                  <span className="text-[var(--accent-amber)] font-medium">{p.credits.toLocaleString()}</span>
                  {" credits"}
                </p>
                <span className="mt-1 inline-block rounded-full bg-[var(--accent-amber)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-amber)]">
                  {p.bonusLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Credit Packs — only for subscribed users */}
      {tier !== "FREE" && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h2 className="mb-4 text-[var(--text-base)] font-medium text-[var(--text-primary)]">
            Credit Packs
          </h2>
          <p className="mb-4 text-[var(--text-sm)] text-[var(--text-secondary)]">
            Need more? Buy credits anytime — purchased credits never expire.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.key}
                onClick={() => handleCheckout("credit_pack", pack.key)}
                disabled={loading === pack.key}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-3 text-sm transition-all duration-200 hover:border-[var(--accent-amber)] hover:bg-[var(--bg-elevated)] disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="text-[var(--text-primary)]">{pack.name}</span>
                <span className="font-medium text-[var(--accent-amber)]">{pack.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h2 className="mb-4 text-[var(--text-base)] font-medium text-[var(--text-primary)]">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-1.5 text-[var(--text-sm)]"
              >
                <span className="text-[var(--text-secondary)]">
                  {t.description}
                </span>
                <div className="flex items-center gap-3">
                  {t.credits !== 0 && (
                    <span className={t.credits > 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>
                      {t.credits > 0 ? "+" : ""}{t.credits.toLocaleString()}
                    </span>
                  )}
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    {new Date(t.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
