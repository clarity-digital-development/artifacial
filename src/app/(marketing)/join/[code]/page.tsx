import Link from "next/link";
import { cookies } from "next/headers";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;

  // Set agent referral cookie server-side so it persists across the apply flow
  const cookieStore = await cookies();
  cookieStore.set("aff_ref_agent", code, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    httpOnly: false, // accessible client-side if needed
    sameSite: "lax",
  });

  const applyUrl = `/apply?agent=${encodeURIComponent(code)}`;

  return (
    <div className="grain ambient-light relative flex min-h-screen items-center justify-center bg-[var(--bg-deep)] px-4 py-12">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[var(--accent-amber)] opacity-[0.025] blur-[100px]" />

      <div className="relative z-10 w-full max-w-[520px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--accent-amber)]">
              Artifacial
            </h1>
          </Link>
        </div>

        {/* Main card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Invite badge */}
          <div className="mb-5 flex items-center gap-2">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="rounded-[var(--radius-sm)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
              Personal Invite
            </span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            You&apos;ve been invited to join the Creator Program
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Invited by{" "}
            <span className="font-semibold text-[var(--accent-amber)]">
              {code}
            </span>{" "}
            — apply now to start earning commissions by referring creators to
            Artifacial.
          </p>

          {/* Benefits */}
          <div className="mt-6 space-y-3">
            {[
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                ),
                title: "20% commission per referral",
                desc: "Earn 20% of every subscription payment for a full 12 months.",
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ),
                title: "Your own promo code",
                desc: "Choose a custom code that represents your brand or name.",
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ),
                title: "Free to join, no minimum",
                desc: "No upfront cost. Apply, get approved, and start sharing.",
              },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]">
                  {b.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {b.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="my-6 h-px bg-[var(--border-subtle)]" />

          {/* CTA */}
          <Link
            href={applyUrl}
            className="block w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3.5 text-center text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_32px_rgba(232,166,52,0.15)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)]"
          >
            Apply Now — It&apos;s Free
          </Link>
          <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link
              href={`/sign-in?callbackUrl=/apply?agent=${encodeURIComponent(code)}`}
              className="text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]"
            >
              Sign in first
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
          By applying you agree to our{" "}
          <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--accent-amber)]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/acceptable-use" className="text-[var(--text-secondary)] hover:text-[var(--accent-amber)]">
            Acceptable Use Policy
          </Link>
          . Commission rates and terms may change with 30 days notice.
        </p>
      </div>
    </div>
  );
}
