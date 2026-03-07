import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="grain ambient-light vignette relative min-h-screen overflow-hidden bg-[var(--bg-deep)]">
      {/* Decorative grid lines */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-40" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-40" />
        <div className="absolute left-3/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-40" />
      </div>

      {/* Hero glow orb */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-amber)] opacity-[0.06] blur-[120px]" />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 lg:px-16">
        <span className="font-display text-xl font-bold tracking-tight text-[var(--accent-amber)]">
          Artifacial
        </span>
        <div className="flex items-center gap-3">
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

      {/* Hero section */}
      <section className="stagger-reveal relative z-10 flex flex-col items-center px-8 pt-24 pb-20 text-center lg:pt-36">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse-glow" />
          <span className="text-xs font-medium tracking-wide text-[var(--text-secondary)]">Now in Early Access</span>
        </div>

        <h1 className="max-w-4xl font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)] md:text-7xl lg:text-8xl">
          Your face.{" "}
          <span className="bg-gradient-to-r from-[var(--accent-amber)] to-[var(--accent-ember)] bg-clip-text text-transparent">
            Any story.
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)] md:text-xl">
          Create persistent AI characters from a selfie or description, then direct short-form videos scene by scene.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="group relative rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-3.5 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_40px_rgba(232,166,52,0.2)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_60px_rgba(232,166,52,0.3)]"
          >
            Start Creating — Free
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-8 py-3.5 text-base font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            See How It Works
          </Link>
        </div>

        <p className="mt-5 text-xs text-[var(--text-muted)]">
          100 free credits on signup. No credit card required.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-8 py-24 lg:px-16">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">How it works</p>
          <h2 className="font-display text-3xl font-bold text-[var(--text-primary)] md:text-4xl">
            Three steps to your first video
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Create a Character",
              description: "Upload a selfie or describe your character. Our AI generates consistent reference images from multiple angles.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
            {
              step: "02",
              title: "Write Your Scene",
              description: "Describe the action, setting, and mood. AI enhances your prompt for cinematic quality.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                </svg>
              ),
            },
            {
              step: "03",
              title: "Generate & Share",
              description: "Hit generate and watch your character come to life in a short-form video ready for social.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 transition-all duration-300 hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
            >
              <span className="mb-6 block font-display text-xs font-bold tracking-[0.3em] text-[var(--accent-amber)]">
                {item.step}
              </span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]">
                {item.icon}
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-[var(--text-primary)]">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="relative z-10 mx-auto max-w-4xl px-8 py-24 text-center lg:px-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">Pricing</p>
        <h2 className="mb-4 font-display text-3xl font-bold text-[var(--text-primary)] md:text-4xl">
          Start free. Scale when you&apos;re ready.
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-[var(--text-secondary)]">
          Get 100 credits free — enough to create characters and generate your first videos. Upgrade for more.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { name: "Starter", price: "$15", credits: "750 credits/mo", note: "great for beginners", featured: false },
            { name: "Creator", price: "$50", credits: "2,500 credits/mo", note: "most popular", featured: true },
            { name: "Pro", price: "$100", credits: "6,000 credits/mo", note: "for power users", featured: false },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[var(--radius-lg)] border p-6 transition-all duration-300 ${
                plan.featured
                  ? "border-[var(--accent-amber)]/30 bg-[var(--bg-elevated)] shadow-[0_0_40px_rgba(232,166,52,0.08)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent-amber)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--bg-deep)]">
                  {plan.note}
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
              <p className="mt-2 font-display text-3xl font-extrabold text-[var(--text-primary)]">
                {plan.price}
                <span className="text-base font-normal text-[var(--text-muted)]">/mo</span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{plan.credits}</p>
              {!plan.featured && <p className="mt-1 text-xs text-[var(--text-muted)]">{plan.note}</p>}
            </div>
          ))}
        </div>

        <Link
          href="/sign-up"
          className="mt-10 inline-block rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-3.5 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)]"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-8 py-8 lg:px-16">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-display text-sm font-bold text-[var(--text-muted)]">Artifacial</span>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 Artifacial. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
