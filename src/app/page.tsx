import Link from "next/link";
import type { Metadata } from "next";
import { StepTimeline } from "@/components/step-timeline";

// ─── SEO ───

export const metadata: Metadata = {
  title: "Artifacial — Cast Yourself in Anything",
  description:
    "Train an AI character from a single selfie. Generate cinematic videos starring you. Face swap, motion transfer, image-to-video — all in one studio.",
  openGraph: {
    title: "Artifacial — Cast Yourself in Anything",
    description:
      "Train an AI character from a selfie. Generate cinematic videos starring you.",
    type: "website",
    url: "https://artifacial.io",
    siteName: "Artifacial",
  },
  twitter: {
    card: "summary_large_image",
    title: "Artifacial — Cast Yourself in Anything",
    description: "Train an AI character from a selfie. Cinematic videos, starring you.",
  },
};

// ─── Capability Reel ───

const REEL = [
  {
    title: "Face Swap",
    desc: "Your face. Any footage.",
    video: "/face-swap-transition-v2.mp4",
  },
  {
    title: "Image → Video",
    desc: "Stills become cinema.",
    video: "/image-to-video-transition.mp4",
  },
  {
    title: "Motion Transfer",
    desc: "Copy moves onto your character.",
    video: "/motion-transfer-pip-v5.mp4",
  },
];

// ─── Workshop chips — feature surface without a deep page ───

const WORKSHOP = [
  "Character Swap",
  "Face Swap",
  "Lip Sync",
  "Upscale",
  "End-Frame Control",
  "Motion Templates",
  "Prompt Enhancer",
];

// ─── Page ───

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; ref?: string }>;
}) {
  const { prompt, ref } = await searchParams;

  if (ref) {
    console.log(`[attribution] ref=${ref} prompt=${prompt ? "yes" : "no"}`);
  }

  const generateUrl = prompt
    ? `/generate?prompt=${encodeURIComponent(prompt)}`
    : "/generate";
  const signUpHref = prompt
    ? `/sign-up?callbackUrl=${encodeURIComponent(generateUrl)}`
    : "/sign-up";
  const signInHref = prompt
    ? `/sign-in?callbackUrl=${encodeURIComponent(generateUrl)}`
    : "/sign-in";

  return (
    <div className="grain vignette relative min-h-screen overflow-hidden bg-[var(--bg-deep)]">
      {/* ─── Background: layered warm light ─── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute left-1/2 top-[-10%] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[var(--accent-amber)] opacity-[0.05] blur-[180px]" />
        <div className="absolute left-[-15%] top-[40%] h-[500px] w-[500px] rounded-full bg-[var(--accent-ember)] opacity-[0.04] blur-[160px]" />
        <div className="absolute right-[-15%] top-[70%] h-[400px] w-[400px] rounded-full bg-[var(--accent-amber)] opacity-[0.03] blur-[160px]" />
      </div>

      {/* ─── Nav ─── */}
      <header className="relative z-20">
        {/* Mobile */}
        <nav className="flex items-center justify-between px-5 pt-4 pb-2 md:hidden">
          <Link href="/" className="font-display text-base tracking-[0.02em] text-[var(--accent-amber)]">
            ARTIFACIAL
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Pricing
            </Link>
            <Link
              href={signInHref}
              className="rounded-full bg-[var(--accent-amber)] px-4 py-1.5 text-sm font-semibold text-[var(--bg-deep)]"
            >
              Sign in
            </Link>
          </div>
        </nav>

        {/* Desktop — sticky pill */}
        <nav className="pointer-events-none sticky top-0 z-50 hidden justify-center px-6 pt-5 pb-3 md:flex">
          <div className="pointer-events-auto flex items-center gap-6 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/70 px-6 py-2.5 shadow-[0_2px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <Link href="/" className="font-display text-sm tracking-[0.02em] text-[var(--accent-amber)]">
              ARTIFACIAL
            </Link>
            <div className="h-3 w-px bg-[var(--border-subtle)]" />
            <Link
              href="/pricing"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Pricing
            </Link>
            <Link
              href={signInHref}
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Sign in
            </Link>
            <Link
              href={signUpHref}
              className="rounded-full bg-[var(--accent-amber)] px-4 py-1.5 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>

      {/* ─────────────────────────────────────── HERO ─────────────────────────────────────── */}
      <section className="relative z-10 px-5 pt-8 pb-16 md:px-10 md:pt-14 md:pb-28 lg:px-16">
        <div className="mx-auto max-w-[1240px]">
          {/* Eyebrow */}
          <div className="animate-fade-in-up flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-amber)] md:justify-start">
            <span className="inline-block h-[1px] w-6 bg-[var(--accent-amber)]/60" />
            AI Video Studio
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-in-up mt-5 font-display text-[44px] leading-[0.98] tracking-[0.01em] text-[var(--text-primary)] sm:text-[64px] md:text-[96px] lg:text-[120px]"
            style={{ animationDelay: "60ms" }}
          >
            Cast yourself.
            <br />
            <span className="italic text-[var(--accent-amber)]" style={{ fontStyle: "italic" }}>
              In anything.
            </span>
          </h1>

          {/* Sub */}
          <p
            className="animate-fade-in-up mt-6 max-w-[560px] text-[15px] leading-relaxed text-[var(--text-secondary)] sm:text-base md:mt-8 md:text-lg"
            style={{ animationDelay: "140ms" }}
          >
            Train a consistent AI character from one selfie. Then drop yourself into cinematic scenes, animated shorts, or anywhere else you can imagine — no crew, no camera.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-in-up mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:mt-10"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              href={signUpHref}
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-7 py-3.5 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_40px_rgba(232,166,52,0.22)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(232,166,52,0.35)]"
            >
              <span className="relative z-10">Start free</span>
              <svg
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#reel"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]/40 px-6 py-3.5 text-base font-medium text-[var(--text-primary)] backdrop-blur-sm transition-colors hover:bg-[var(--bg-surface)]/80"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              </span>
              See it in action
            </a>
          </div>

          <p
            className="animate-fade-in-up mt-4 text-xs text-[var(--text-muted)]"
            style={{ animationDelay: "300ms" }}
          >
            3 generations free · No card required
          </p>
        </div>

        {/* ─── Reel strip ─── */}
        <div
          id="reel"
          className="animate-fade-in-up mx-auto mt-14 max-w-[1240px] md:mt-20"
          style={{ animationDelay: "380ms" }}
        >
          {/* Mobile: scroll-snap horizontal */}
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 showcase-scroll md:hidden">
            {REEL.map((item) => (
              <ReelCard key={item.title} {...item} className="min-w-[78%] snap-start" />
            ))}
          </div>

          {/* Desktop: 3-up grid */}
          <div className="hidden gap-4 md:grid md:grid-cols-3 md:gap-5">
            {REEL.map((item) => (
              <ReelCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── HOW IT WORKS ─────────────────────────────── */}
      <section className="relative z-10 border-t border-[var(--border-subtle)] px-5 py-16 md:px-16 md:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-amber)]">
            <span className="inline-block h-[1px] w-6 bg-[var(--accent-amber)]/60" />
            The flow
          </div>

          <h2 className="mt-4 max-w-[700px] font-display text-[32px] leading-[1.02] text-[var(--text-primary)] sm:text-[44px] md:text-[64px]">
            Selfie to cinema,
            <br />
            <span className="text-[var(--text-muted)]">in three steps.</span>
          </h2>

          <StepTimeline />
        </div>
      </section>

      {/* ─────────────────────────────── WORKSHOP STRIP ─────────────────────────────── */}
      <section className="relative z-10 border-t border-[var(--border-subtle)] px-5 py-16 md:px-16 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1fr] md:gap-16 md:items-center">
            <div>
              <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-amber)]">
                <span className="inline-block h-[1px] w-6 bg-[var(--accent-amber)]/60" />
                Inside the studio
              </div>
              <h2 className="mt-4 font-display text-[30px] leading-[1.05] text-[var(--text-primary)] sm:text-[40px] md:text-[52px]">
                A workshop,
                <br />
                <span className="text-[var(--text-muted)]">not just a generator.</span>
              </h2>
              <p className="mt-5 max-w-[440px] text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
                Everything you need to finish a video sits in one place — face swap, upscale, lip sync, end-frame control, and a growing library of creative tools. Your studio, your settings, your call.
              </p>

              <Link
                href={signUpHref}
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]"
              >
                Open the workshop
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="flex flex-wrap gap-2.5 md:gap-3">
              {WORKSHOP.map((tool, i) => (
                <span
                  key={tool}
                  className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/50 px-4 py-2 text-sm font-medium text-[var(--text-primary)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--accent-amber)]/40 hover:bg-[var(--accent-amber-glow)] hover:text-[var(--accent-amber)]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {tool}
                </span>
              ))}
              <span className="rounded-full border border-dashed border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-muted)]">
                + more each week
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── PROOF NUMBERS ─────────────────────────────── */}
      <section className="relative z-10 border-t border-[var(--border-subtle)] px-5 py-14 md:px-16 md:py-20">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          <Stat value="10+" label="AI video models" />
          <Stat value="<2m" label="Average render" />
          <Stat value="1080p" label="Cinematic output" />
          <Stat value="24/7" label="Studio uptime" />
        </div>
      </section>

      {/* ─────────────────────────────── FINAL CTA ─────────────────────────────── */}
      <section className="relative z-10 overflow-hidden px-5 py-20 md:px-16 md:py-32">
        {/* Large amber wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-amber)] opacity-[0.06] blur-[120px]"
        />

        <div className="relative mx-auto max-w-[820px] text-center">
          <h2 className="font-display text-[38px] leading-[1.02] text-[var(--text-primary)] sm:text-[52px] md:text-[72px]">
            Your first video,
            <br />
            <span className="italic text-[var(--accent-amber)]">on us.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[480px] text-base leading-relaxed text-[var(--text-secondary)]">
            Three free generations. No card. Be rendering in under a minute.
          </p>
          <Link
            href={signUpHref}
            className="group mt-9 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-8 py-4 text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_40px_rgba(232,166,52,0.25)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(232,166,52,0.4)]"
          >
            Create your first video
            <svg
              className="transition-transform duration-300 group-hover:translate-x-0.5"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="mt-5">
            <Link
              href="/pricing"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              View plans →
            </Link>
          </p>
        </div>
      </section>

      {/* ─────────────────────────────── FOOTER ─────────────────────────────── */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-5 py-10 md:px-16">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <Link href="/" className="font-display text-sm tracking-[0.02em] text-[var(--accent-amber)]">
            ARTIFACIAL
          </Link>
          <div className="flex flex-wrap justify-center gap-5 text-xs text-[var(--text-muted)]">
            <Link href="/pricing" className="transition-colors hover:text-[var(--text-secondary)]">Pricing</Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--text-secondary)]">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--text-secondary)]">Privacy</Link>
            <Link href="/acceptable-use" className="transition-colors hover:text-[var(--text-secondary)]">Acceptable Use</Link>
            <Link href="/support" className="transition-colors hover:text-[var(--text-secondary)]">Support</Link>
          </div>
          <p className="text-xs text-[var(--text-muted)]">© 2026 Artifacial</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Reel Card ───

function ReelCard({
  title,
  desc,
  video,
  className = "",
}: {
  title: string;
  desc: string;
  video: string;
  className?: string;
}) {
  return (
    <div
      className={`group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-500 hover:border-[var(--accent-amber)]/40 hover:shadow-[0_0_40px_rgba(232,166,52,0.08)] md:aspect-[3/4] ${className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        src={video}
      />

      {/* Bottom gradient mask */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent" />

      {/* Label */}
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
        <p className="font-display text-[15px] tracking-[0.01em] text-white md:text-lg">
          {title}
        </p>
        <p className="mt-1 text-sm text-white/60">{desc}</p>
      </div>

      {/* Corner play indicator */}
      <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm transition-all duration-300 group-hover:border-[var(--accent-amber)] group-hover:bg-[var(--accent-amber)]/20">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
      </div>
    </div>
  );
}

// ─── Stat ───

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <p className="font-display text-[36px] leading-none text-[var(--text-primary)] md:text-[56px]">
        {value}
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] md:text-xs">
        {label}
      </p>
    </div>
  );
}
