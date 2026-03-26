import Link from "next/link";
import { PricingCards } from "./pricing-client";

const CREDIT_COSTS = [
  { action: "1 image (budget models)", credits: 30 },
  { action: "1 image (standard models)", credits: 50 },
  { action: "5s video (budget, 720p)", credits: "300–500" },
  { action: "5s video (standard, 720p)", credits: "300–350" },
  { action: "5s video (ultra, 720p)", credits: "480–500" },
  { action: "10s video (standard, 720p)", credits: "480–700" },
  { action: "10s video (ultra, 1080p)", credits: "900–1,440" },
  { action: "15s video (ultra, 1080p)", credits: "1,350–2,250" },
];

const CREDIT_PACKS = [
  { credits: "5,000 credits", price: "$9.99" },
  { credits: "15,000 credits", price: "$24.99" },
];

export default function PricingPage() {
  return (
    <div className="grain ambient-light relative min-h-screen bg-[var(--bg-deep)]">
      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 lg:px-16">
        <Link href="/" className="font-display text-xl font-bold tracking-tight text-[var(--accent-amber)]">
          Artifacial
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="relative z-10 px-8 pt-16 pb-12 text-center lg:px-16">
        <h1 className="font-display text-4xl font-extrabold text-[var(--text-primary)] md:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--text-secondary)]">
          Choose the plan that fits your creative workflow. All plans include credit rollover.
        </p>
      </section>

      {/* Plan Cards */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pb-20 lg:px-16">
        <PricingCards />
      </section>

      {/* Credit Cost Table */}
      <section className="relative z-10 mx-auto max-w-3xl px-8 py-16 lg:px-16">
        <h2 className="mb-8 text-center font-display text-2xl font-bold text-[var(--text-primary)]">
          Credit Costs
        </h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {CREDIT_COSTS.map((item, i) => (
            <div
              key={item.action}
              className={`flex items-center justify-between px-6 py-3.5 ${
                i < CREDIT_COSTS.length - 1 ? "border-b border-[var(--border-subtle)]" : ""
              }`}
            >
              <span className="text-sm text-[var(--text-secondary)]">{item.action}</span>
              <span className="text-sm font-semibold text-[var(--accent-amber)]">
                {item.credits} credits
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Credit Packs */}
      <section className="relative z-10 mx-auto max-w-xl px-8 pb-24 text-center lg:px-16">
        <h2 className="mb-2 font-display text-xl font-bold text-[var(--text-primary)]">
          Need more credits?
        </h2>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">
          Buy credit packs anytime. Purchased credits never expire.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.credits}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-4"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">{pack.credits}</span>
              <span className="font-semibold text-[var(--accent-amber)]">{pack.price}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Available to subscribed users only.
        </p>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-8 py-8 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="font-display text-sm font-bold text-[var(--accent-amber)]">
            Artifacial
          </Link>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 Artifacial. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
