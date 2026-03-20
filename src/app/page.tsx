import Link from "next/link";
import type { Metadata } from "next";
import { StepTimeline } from "@/components/step-timeline";

// ─── SEO ───

export const metadata: Metadata = {
  title: "Artifacial — AI Character & Video Generation. No Limits.",
  description:
    "Create AI characters from a single selfie. Generate cinematic videos in seconds. Face swap, lip sync, motion transfer, and more. Complete creative freedom.",
  openGraph: {
    title: "Artifacial — Your Characters. No Limits.",
    description:
      "Create AI characters from a single selfie. Generate cinematic videos in seconds. Complete creative freedom.",
    type: "website",
    url: "https://artifacial.io",
    siteName: "Artifacial",
  },
  twitter: {
    card: "summary_large_image",
    title: "Artifacial — AI Video Generation. No Limits.",
    description:
      "Create AI characters from a selfie. Generate cinematic videos in seconds.",
  },
};

// ─── Capability Cards ───

const CAPABILITIES = [
  {
    title: "Video Face Swap",
    tagline: "Your face. Any scene. Seamless.",
    gradient: "from-amber-900/40 to-orange-900/10",
    icon: "face-swap",
    video: "/face-swap-transition-v2.mp4",
  },
  {
    title: "Image to Video",
    tagline: "Watch your photos come alive.",
    gradient: "from-rose-900/40 to-red-900/10",
    icon: "lip-sync",
    video: "/image-to-video-transition.mp4",
  },
  {
    title: "Motion Transfer",
    tagline: "Copy any movement to your character.",
    gradient: "from-violet-900/40 to-purple-900/10",
    icon: "motion",
    video: "/motion-transfer-pip-v5.mp4",
  },
];

// ─── Capability Icons ───

function CapabilityIcon({ name, className }: { name: string; className?: string }) {
  const cls = className ?? "w-8 h-8 text-white/25";
  switch (name) {
    case "face-swap":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="7" />
          <circle cx="15" cy="15" r="7" />
        </svg>
      );
    case "lip-sync":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "motion":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4h3a2 2 0 0 1 2 2v14" />
          <path d="M2 20h3" />
          <path d="M13 20h9" />
          <path d="M10 12V4.5a2.5 2.5 0 0 0-5 0V12" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── Step Icons ───

function StepCamera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function StepPrompt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

function StepPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

// ─── Page ───

export default function LandingPage() {
  return (
    <div className="grain relative min-h-screen bg-[var(--bg-deep)]">
      {/* ─── Nav: hidden on mobile, sticky pill on desktop ─── */}
      <nav className="pointer-events-none sticky top-0 z-50 hidden justify-center px-6 pt-5 pb-3 md:flex">
        <div className="pointer-events-auto flex items-center gap-5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-5 py-2.5 shadow-[0_2px_16px_rgba(0,0,0,0.3)] backdrop-blur-md sm:gap-6 sm:px-6">
          <Link href="/" className="font-display text-base font-bold tracking-tight text-[var(--accent-amber)]">
            Artifacial
          </Link>
          <div className="h-4 w-px bg-[var(--border-subtle)]" />
          <Link
            href="/pricing"
            className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-[var(--accent-amber)] px-5 py-1.5 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── Ambient glow (lightweight, no client JS) ─── */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-[var(--accent-amber)] opacity-[0.03] blur-[200px]" />
        <div className="absolute left-1/2 top-[10%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[var(--accent-amber)] opacity-[0.04] blur-[180px]" />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative z-10 flex flex-col items-center px-5 pt-12 pb-10 text-center md:min-h-[calc(100vh-72px)] md:justify-center md:px-16 md:pt-0 md:pb-16">
        {/* Mobile logo */}
        <span className="mb-6 font-display text-lg font-bold tracking-tight text-[var(--accent-amber)] md:hidden">
          Artifacial
        </span>

        <h1 className="max-w-lg font-display text-4xl font-extrabold leading-[1.1] tracking-[0.03em] text-[var(--text-primary)] sm:text-5xl md:max-w-4xl md:text-7xl lg:text-8xl">
          Your Characters.
          <br />
          <span className="bg-gradient-to-r from-[var(--accent-amber)] to-[var(--accent-ember)] bg-clip-text text-transparent">
            No Limits.
          </span>
        </h1>

        <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)] sm:max-w-md sm:text-base md:max-w-lg md:text-lg">
          Create AI characters from a selfie. Generate videos in seconds. Complete creative freedom.
        </p>

        {/* Single CTA — full width on mobile */}
        <Link
          href="/sign-up"
          className="mt-8 w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-4 text-center text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_40px_rgba(232,166,52,0.2)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_60px_rgba(232,166,52,0.3)] md:w-auto md:py-3.5"
        >
          Start Creating &mdash; Free
        </Link>

        <p className="mt-3 text-xs text-[var(--text-muted)]">
          3 free generations. No credit card required.
        </p>

        {/* Capability cards — flow directly from CTA */}
        <div className="mt-8 flex w-full max-w-sm flex-col gap-4 md:mt-10 md:max-w-5xl md:flex-row md:gap-6">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="group relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--accent-amber)]/30 hover:shadow-[0_0_24px_rgba(232,166,52,0.08)] md:flex-1"
            >
              {cap.video ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  src={cap.video}
                />
              ) : (
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${cap.gradient}`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CapabilityIcon name={cap.icon} className="h-10 w-10 text-white/20" />
                  </div>
                </>
              )}

              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-10">
                <p className="font-display text-base font-semibold text-white/90">{cap.title}</p>
                <p className="mt-0.5 text-sm text-white/50">{cap.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="relative z-10 px-5 py-12 md:px-16 md:py-20">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
          How it works
        </p>
        <h2 className="mb-10 text-center font-display text-2xl font-bold text-[var(--text-primary)] md:mb-14 md:text-3xl">
          Three steps to your first video
        </h2>

        {/* Mobile: stacked layout */}
        <div className="mx-auto flex max-w-sm flex-col gap-8 md:hidden">
          {[
            { title: "Create your character", desc: "One photo builds your persistent AI identity.", icon: StepCamera },
            { title: "Write your scene", desc: "Describe what happens — the AI handles the rest.", icon: StepPrompt },
            { title: "Generate in seconds", desc: "Cinematic video, ready to post.", icon: StepPlay },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent-amber)]/50 bg-[var(--bg-surface)] shadow-[0_0_20px_rgba(232,166,52,0.08)]">
                  <Icon className="h-5 w-5 text-[var(--accent-amber)]" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: scroll-activated gas tube animation */}
        <StepTimeline />
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative z-10 px-5 py-16 text-center md:py-24">
        <p className="text-base text-[var(--text-primary)] sm:text-lg">
          Start with 3 free generations. No card required.
        </p>
        <Link
          href="/sign-up"
          className="mt-6 inline-block w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-4 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_40px_rgba(232,166,52,0.25)] md:w-auto md:py-3.5"
        >
          Start Creating
        </Link>
        <p className="mt-4">
          <Link
            href="/pricing"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
          >
            View pricing &rarr;
          </Link>
        </p>
      </section>

      {/* ─── Footer (minimal) ─── */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-5 py-8 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
          <Link href="/" className="font-display text-sm font-bold text-[var(--accent-amber)]">
            Artifacial
          </Link>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-[var(--text-muted)]">
            <Link href="/pricing" className="transition-colors hover:text-[var(--text-secondary)]">Pricing</Link>
            <a href="#" className="transition-colors hover:text-[var(--text-secondary)]">Terms</a>
            <a href="#" className="transition-colors hover:text-[var(--text-secondary)]">Privacy</a>
          </div>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 Artifacial. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
