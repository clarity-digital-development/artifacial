import Link from "next/link";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    credits: "100 credits",
    creditsNote: "one-time",
    features: [
      "100 credits on signup",
      "All generation modes",
      "720p resolution",
      "Community support",
    ],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Starter",
    price: "$15",
    period: "/mo",
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
  },
  {
    name: "Creator",
    price: "$50",
    period: "/mo",
    annualPrice: "$40/mo billed annually",
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
  },
  {
    name: "Pro",
    price: "$100",
    period: "/mo",
    annualPrice: "$80/mo billed annually",
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
  },
  {
    name: "Studio",
    price: "$165",
    period: "/mo",
    annualPrice: "Annual billing only",
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
  },
];

const CREDIT_COSTS = [
  { action: "1 image generation", credits: 10 },
  { action: "Character creation (4 angles)", credits: 40 },
  { action: "1 second of video", credits: 40 },
  { action: "5-second video", credits: 200 },
  { action: "10-second video", credits: 400 },
  { action: "Video upscale (720p enhance)", credits: 10 },
  { action: "Video upscale to 1080p", credits: 20 },
  { action: "Video upscale to 1440p", credits: 30 },
];

const CREDIT_PACKS = [
  { credits: "500 credits", price: "$9.99" },
  { credits: "1,250 credits", price: "$24.99" },
];

export default function PricingPage() {
  return (
    <div className="grain ambient-light vignette relative min-h-screen bg-[var(--bg-deep)]">
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
          Start with 100 free credits. Upgrade for more power, higher resolution, and priority queue access.
        </p>
      </section>

      {/* Plan Cards */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pb-20 lg:px-16">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[var(--radius-lg)] border p-6 transition-all duration-300 ${
                plan.featured
                  ? "border-[var(--accent-amber)]/40 bg-[var(--bg-elevated)] shadow-[0_0_40px_rgba(232,166,52,0.1)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent-amber)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--bg-deep)]">
                  Recommended
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {plan.name}
              </h3>
              <div className="mt-3">
                <span className="font-display text-3xl font-extrabold text-[var(--text-primary)]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-[var(--text-muted)]">{plan.period}</span>
                )}
              </div>
              {"annualPrice" in plan && plan.annualPrice && (
                <p className="mt-1 text-xs text-[var(--accent-amber)]">{plan.annualPrice}</p>
              )}
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {plan.credits} <span className="text-[var(--text-muted)]">{plan.creditsNote}</span>
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent-amber)]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className={`mt-6 block rounded-[var(--radius-md)] px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                  plan.featured
                    ? "bg-[var(--accent-amber)] text-[var(--bg-deep)] hover:bg-[var(--accent-amber-dim)]"
                    : "border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
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
