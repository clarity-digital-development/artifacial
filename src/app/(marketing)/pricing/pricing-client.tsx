"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    monthlyPrice: "$15",
    annualPrice: null,
    displayPrice: "$15",
    credits: "1,500 credits",
    creditsNote: "per month",
    features: [
      "1,500 credits/month",
      "All generation modes",
      "720p resolution",
      "Credit packs available",
      "Priority support",
    ],
    cta: "Subscribe",
    featured: false,
    annualOnly: false,
    hasAnnual: false,
  },
  {
    name: "Creator",
    monthlyPrice: "$50",
    annualPrice: "$40",
    displayPrice: "$40",
    credits: "5,000 credits",
    creditsNote: "per month",
    features: [
      "5,000 credits/month",
      "All generation modes",
      "Up to 1080p resolution",
      "Credit packs available",
      "Priority queue",
      "Priority support",
    ],
    cta: "Subscribe",
    featured: true,
    annualOnly: false,
    hasAnnual: true,
  },
  {
    name: "Pro",
    monthlyPrice: "$100",
    annualPrice: "$80",
    displayPrice: "$80",
    credits: "15,000 credits",
    creditsNote: "per month",
    features: [
      "15,000 credits/month",
      "All generation modes",
      "Up to 1440p resolution",
      "Credit packs available",
      "Higher priority queue",
      "Priority support",
    ],
    cta: "Subscribe",
    featured: false,
    annualOnly: false,
    hasAnnual: true,
  },
  {
    name: "Studio",
    monthlyPrice: null,
    annualPrice: "$165",
    displayPrice: "$165",
    credits: "50,000 credits",
    creditsNote: "per month",
    features: [
      "50,000 video credits/month",
      "Unlimited image generation",
      "All generation modes",
      "Up to 1440p resolution",
      "Highest priority queue",
      "Dedicated support",
    ],
    cta: "Contact Us",
    featured: false,
    annualOnly: true,
    hasAnnual: true,
  },
];

export function PricingCards() {
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const isAnnual = billing === "annual";

  return (
    <>
      {/* Billing Toggle */}
      <div className="mb-10 flex items-center justify-center gap-1">
        <div className="relative flex rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={`relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
              !isAnnual
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
              isAnnual
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Annual
            <span className="ml-1.5 text-[10px] font-semibold text-[var(--accent-amber)]">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = isAnnual
            ? (plan.annualPrice ?? plan.monthlyPrice ?? "$0")
            : (plan.monthlyPrice ?? null);

          const unavailable = !isAnnual && plan.annualOnly;

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[var(--radius-lg)] border p-6 transition-all duration-300 ${
                plan.featured
                  ? "border-[var(--accent-amber)]/40 bg-[var(--bg-elevated)] shadow-[0_0_40px_rgba(232,166,52,0.1)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              } ${unavailable ? "opacity-50" : ""}`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent-amber)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--bg-deep)]">
                  Recommended
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {plan.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-[var(--text-primary)]">
                  {unavailable ? "—" : price}
                </span>
                {!unavailable && (
                  <span className="text-sm text-[var(--text-muted)]">/mo</span>
                )}
              </div>
              {!unavailable && isAnnual && plan.hasAnnual && plan.monthlyPrice && !plan.annualOnly && (
                <p className="mt-1 text-xs text-[var(--text-muted)] line-through">
                  {plan.monthlyPrice}/mo
                </p>
              )}
              {unavailable && (
                <p className="mt-1 text-xs text-[var(--accent-amber)]">
                  Annual billing only
                </p>
              )}
              {!unavailable && isAnnual && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  billed annually
                </p>
              )}
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {plan.credits}{" "}
                <span className="text-[var(--text-muted)]">{plan.creditsNote}</span>
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent-amber)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={unavailable ? "#" : "/sign-up"}
                className={`mt-6 block rounded-[var(--radius-md)] px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                  unavailable
                    ? "pointer-events-none border border-[var(--border-subtle)] text-[var(--text-muted)]"
                    : plan.featured
                      ? "bg-[var(--accent-amber)] text-[var(--bg-deep)] hover:bg-[var(--accent-amber-dim)]"
                      : "border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {unavailable ? "Switch to Annual" : plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
