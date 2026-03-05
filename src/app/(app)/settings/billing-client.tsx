"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";

// ─── Types ───

interface Transaction {
  id: string;
  type: string;
  imageCredits: number;
  videoCredits: number;
  description: string;
  createdAt: string;
}

interface BillingClientProps {
  plan: string;
  planName: string;
  imageCredits: number;
  videoCredits: number;
  hasStripeCustomer: boolean;
  transactions: Transaction[];
}

const PLANS = [
  { key: "starter", name: "Starter", price: "$9.99", imageCredits: 30, videoCredits: 15 },
  { key: "creator", name: "Creator", price: "$19.99", imageCredits: 50, videoCredits: 30 },
  { key: "pro", name: "Pro", price: "$29.99", imageCredits: 80, videoCredits: 50 },
];

const CREDIT_PACKS = [
  { key: "image_20", name: "20 Image Credits", price: "$2.99" },
  { key: "video_10", name: "10 Video Credits", price: "$4.99" },
  { key: "video_30", name: "30 Video Credits", price: "$12.99" },
];

const PLAN_LIMITS: Record<string, { image: number; video: number }> = {
  free: { image: 8, video: 2 },
  starter: { image: 30, video: 15 },
  creator: { image: 50, video: 30 },
  pro: { image: 80, video: 50 },
};

// ─── Component ───

export function BillingClient({
  plan,
  planName,
  imageCredits,
  videoCredits,
  hasStripeCustomer,
  transactions,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

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
      <Card className="p-6">
        <h2 className="mb-4 text-[var(--text-base)] font-medium text-[var(--text-primary)]">
          Credits
        </h2>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[var(--text-sm)]">
              <span className="text-[var(--text-secondary)]">Image Credits</span>
              <span className="font-medium text-[var(--text-primary)]">
                {imageCredits}
              </span>
            </div>
            <ProgressBar
              progress={limits.image > 0 ? (Math.min(imageCredits, limits.image) / limits.image) * 100 : 0}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[var(--text-sm)]">
              <span className="text-[var(--text-secondary)]">Video Credits</span>
              <span className="font-medium text-[var(--text-primary)]">
                {videoCredits}
              </span>
            </div>
            <ProgressBar
              progress={limits.video > 0 ? (Math.min(videoCredits, limits.video) / limits.video) * 100 : 0}
            />
          </div>
        </div>
      </Card>

      {/* Plan */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[var(--text-base)] font-medium text-[var(--text-primary)]">
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
          <Badge variant={plan === "free" ? "default" : "amber"}>
            {plan === "free" ? "Free" : "Active"}
          </Badge>
        </div>

        {plan === "free" ? (
          <p className="mb-5 text-[var(--text-sm)] text-[var(--text-secondary)]">
            {limits.image} image credits and {limits.video} video credits per month.
            Upgrade for more.
          </p>
        ) : (
          <p className="mb-5 text-[var(--text-sm)] text-[var(--text-secondary)]">
            {limits.image} image credits and {limits.video} video credits per month,
            renewing with your subscription.
          </p>
        )}

        {plan === "free" && (
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
                  {p.imageCredits} img + {p.videoCredits} vid
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Credit Packs */}
      <Card className="p-6">
        <h2 className="mb-4 text-[var(--text-base)] font-medium text-[var(--text-primary)]">
          Credit Packs
        </h2>
        <p className="mb-4 text-[var(--text-sm)] text-[var(--text-secondary)]">
          Need more? Buy credits anytime — they never expire.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Button
              key={pack.key}
              variant="secondary"
              size="sm"
              onClick={() => handleCheckout("credit_pack", pack.key)}
              disabled={loading === pack.key}
              className="justify-between"
            >
              <span>{pack.name}</span>
              <span className="text-[var(--accent-amber)]">{pack.price}</span>
            </Button>
          ))}
        </div>
      </Card>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card className="p-6">
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
                  {t.imageCredits !== 0 && (
                    <span className={t.imageCredits > 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>
                      {t.imageCredits > 0 ? "+" : ""}{t.imageCredits} img
                    </span>
                  )}
                  {t.videoCredits !== 0 && (
                    <span className={t.videoCredits > 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>
                      {t.videoCredits > 0 ? "+" : ""}{t.videoCredits} vid
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
        </Card>
      )}
    </>
  );
}
