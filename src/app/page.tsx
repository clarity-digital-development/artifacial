import Link from "next/link";

const SHOWCASE_SECTIONS = [
  {
    label: "Image to Video",
    tagline: "Upload a photo. Describe the motion. Watch it move.",
    cards: [
      { title: "Portrait Animation", gradient: "from-amber-900/20 to-orange-900/10" },
      { title: "Action Scene", gradient: "from-rose-900/20 to-red-900/10" },
      { title: "Dance Sequence", gradient: "from-violet-900/20 to-purple-900/10" },
      { title: "Cinematic Close-up", gradient: "from-sky-900/20 to-blue-900/10" },
    ],
  },
  {
    label: "Face Swap",
    tagline: "Your face. Any scene. Seamless.",
    cards: [
      { title: "Viral Reactions", gradient: "from-emerald-900/20 to-green-900/10" },
      { title: "Music Videos", gradient: "from-pink-900/20 to-rose-900/10" },
      { title: "Skits & Comedy", gradient: "from-amber-900/20 to-yellow-900/10" },
      { title: "Duets & Collabs", gradient: "from-cyan-900/20 to-teal-900/10" },
    ],
  },
  {
    label: "Motion Transfer",
    tagline: "See a move you like? Your character can do it too.",
    cards: [
      { title: "Trending Dances", gradient: "from-fuchsia-900/20 to-pink-900/10" },
      { title: "Action Clips", gradient: "from-red-900/20 to-orange-900/10" },
      { title: "Thirst Traps", gradient: "from-teal-900/20 to-emerald-900/10" },
      { title: "Transition Videos", gradient: "from-indigo-900/20 to-violet-900/10" },
    ],
  },
  {
    label: "Talking Head",
    tagline: "Give your characters a voice. Literally.",
    cards: [
      { title: "Faceless Channels", gradient: "from-blue-900/20 to-indigo-900/10" },
      { title: "Storytelling", gradient: "from-amber-900/20 to-orange-900/10" },
      { title: "Product Reviews", gradient: "from-green-900/20 to-emerald-900/10" },
      { title: "AI Influencer", gradient: "from-purple-900/20 to-violet-900/10" },
    ],
  },
  {
    label: "Style Transfer",
    tagline: "Transform existing footage into something entirely new.",
    cards: [
      { title: "Anime Conversion", gradient: "from-pink-900/20 to-fuchsia-900/10" },
      { title: "Oil Painting", gradient: "from-yellow-900/20 to-amber-900/10" },
      { title: "Cyberpunk", gradient: "from-cyan-900/20 to-blue-900/10" },
      { title: "Watercolor", gradient: "from-sky-900/20 to-indigo-900/10" },
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="grain ambient-light vignette relative min-h-screen overflow-hidden bg-[var(--bg-deep)]">
      {/* Decorative grid lines */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-30" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-30" />
        <div className="absolute left-3/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent opacity-30" />
      </div>

      {/* Hero glow */}
      <div className="pointer-events-none absolute left-1/2 top-[20%] z-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-amber)] opacity-[0.05] blur-[150px]" />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 lg:px-16">
        <span className="font-display text-xl font-bold tracking-tight text-[var(--accent-amber)]">
          Artifacial
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Pricing
          </Link>
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

      {/* ─── Hero ─── */}
      <section className="stagger-reveal relative z-10 flex flex-col items-center px-8 pt-20 pb-16 text-center lg:pt-32">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse-glow" />
          <span className="text-xs font-medium tracking-wide text-[var(--text-secondary)]">
            Unfiltered AI Video Generation
          </span>
        </div>

        <h1 className="max-w-5xl font-display text-5xl font-extrabold leading-[1.08] tracking-tight text-[var(--text-primary)] md:text-7xl lg:text-[5.5rem]">
          Your Characters. Your Story.{" "}
          <span className="bg-gradient-to-r from-[var(--accent-amber)] to-[var(--accent-ember)] bg-clip-text text-transparent">
            No Limits.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)] md:text-xl">
          Create AI characters from a single selfie. Generate cinematic videos in seconds.
          Complete creative freedom.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="group relative rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-3.5 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_40px_rgba(232,166,52,0.2)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_60px_rgba(232,166,52,0.3)]"
          >
            Start Creating &mdash; Free
          </Link>
          <Link
            href="#showcase"
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-8 py-3.5 text-base font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Watch the Reel
          </Link>
        </div>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          100 free credits on signup. No credit card required.
        </p>
      </section>

      {/* ─── Generation Showcase Strips ─── */}
      <section id="showcase" className="relative z-10 py-16">
        {SHOWCASE_SECTIONS.map((section, sectionIdx) => (
          <div key={section.label} className="mb-16 last:mb-0">
            <div className="mb-6 px-8 text-center lg:px-16">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
                {section.label}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {section.tagline}
              </p>
            </div>

            {/* Horizontally scrollable strip */}
            <div className="flex justify-center gap-5 overflow-x-auto px-8 py-3 lg:px-16 scrollbar-hide">
              {section.cards.map((card, cardIdx) => (
                <div
                  key={card.title}
                  className="group relative flex-shrink-0 w-[340px] aspect-[16/10] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden transition-all duration-300 hover:border-[var(--accent-amber)]/30 hover:shadow-[0_0_24px_rgba(232,166,52,0.08)] hover:scale-[1.02]"
                  style={{
                    animationDelay: `${sectionIdx * 100 + cardIdx * 50}ms`,
                  }}
                >
                  {/* Placeholder gradient — replace with actual thumbnails */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-amber)]/90 shadow-lg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-[#0A0A0B]">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
                    <p className="text-sm font-medium text-white/90">{card.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-5xl px-8 py-24 lg:px-16">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold text-[var(--text-primary)] md:text-4xl">
            Three steps to your first video
          </h2>
        </div>

        <div className="relative flex flex-col items-center gap-0 md:flex-row md:gap-0">
          {/* Connecting line */}
          <div className="absolute top-1/2 left-[10%] right-[10%] hidden h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent md:block" />

          {[
            { step: "1", title: "Upload a selfie", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
            { step: "2", title: "Describe your scene", icon: "M4 6h16M4 12h16m-7 6h7" },
            { step: "3", title: "Generate in seconds", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
          ].map((item) => (
            <div key={item.step} className="relative z-10 flex flex-1 flex-col items-center py-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--accent-amber)] bg-[var(--bg-surface)] text-[var(--accent-amber)]">
                <span className="font-display text-xl font-bold">{item.step}</span>
              </div>
              <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                {item.title}
              </h3>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Social Proof ─── */}
      <section className="relative z-10 mx-auto max-w-3xl px-8 py-16 text-center lg:px-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
          Built for creators
        </p>
        <h2 className="mt-4 font-display text-2xl font-bold text-[var(--text-primary)] md:text-3xl">
          Create without compromise
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--text-secondary)]">
          Your vision, unfiltered. No guardrails on your imagination. Join creators already building with Artifacial.
        </p>
      </section>

      {/* ─── Pricing Preview ─── */}
      <section className="relative z-10 mx-auto max-w-5xl px-8 py-24 text-center lg:px-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
          Pricing
        </p>
        <h2 className="mb-4 font-display text-3xl font-bold text-[var(--text-primary)] md:text-4xl">
          Start free. Scale when you&apos;re ready.
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-[var(--text-secondary)]">
          100 free credits on signup. No credit card required.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Starter", price: "$15", credits: "1,500", featured: false },
            { name: "Creator", price: "$50", credits: "5,000", featured: true },
            { name: "Pro", price: "$100", credits: "15,000", featured: false },
            { name: "Studio", price: "$165", credits: "50,000", featured: false },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[var(--radius-lg)] border p-6 transition-all duration-300 ${
                plan.featured
                  ? "border-[var(--accent-amber)]/40 bg-[var(--bg-elevated)] shadow-[0_0_40px_rgba(232,166,52,0.08)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent-amber)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--bg-deep)]">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">{plan.name}</h3>
              <p className="mt-2 font-display text-2xl font-extrabold text-[var(--text-primary)]">
                {plan.price}
                <span className="text-sm font-normal text-[var(--text-muted)]">/mo</span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {plan.credits} credits/mo
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-3.5 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)]"
          >
            Start Free
          </Link>
          <Link
            href="/pricing"
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-8 py-3.5 text-base font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            View Full Pricing
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-8 py-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <span className="font-display text-sm font-bold text-[var(--accent-amber)]">
              Artifacial
            </span>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Unfiltered AI Video Generation
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
            <Link href="/pricing" className="transition-colors hover:text-[var(--text-secondary)]">
              Pricing
            </Link>
            <span className="transition-colors hover:text-[var(--text-secondary)] cursor-pointer">
              Terms
            </span>
            <span className="transition-colors hover:text-[var(--text-secondary)] cursor-pointer">
              Privacy
            </span>
            <span className="transition-colors hover:text-[var(--text-secondary)] cursor-pointer">
              Contact
            </span>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            &copy; 2026 Artifacial. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
