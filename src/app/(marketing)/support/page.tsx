import Link from "next/link";

export const metadata = { title: "Support — Artifacial" };

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] px-5 py-16 md:px-16">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Link href="/" className="mb-10 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </Link>

        {/* Header */}
        <div className="mb-12">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-amber)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="font-display text-4xl font-bold text-[var(--text-primary)]">Support</h1>
          <p className="mt-3 text-[var(--text-secondary)]">
            We're here to help. Reach out and we'll get back to you as soon as possible.
          </p>
        </div>

        {/* Contact card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
          <h2 className="mb-1 font-display text-lg font-bold text-[var(--text-primary)]">Email Support</h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">
            For account issues, billing questions, content concerns, or anything else — send us an email and we'll respond within 1–2 business days.
          </p>
          <a
            href="mailto:tanner@claritydigital.dev"
            className="inline-flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_36px_rgba(232,166,52,0.2)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            tanner@claritydigital.dev
          </a>
        </div>

        {/* FAQ-style common topics */}
        <div className="mt-8 space-y-3">
          <h2 className="mb-4 font-display text-lg font-bold text-[var(--text-primary)]">Common Topics</h2>

          {[
            {
              q: "Billing & subscriptions",
              a: "To cancel, upgrade, or get a refund inquiry, email us with your account email and a description of the issue.",
            },
            {
              q: "Account access",
              a: "If you're locked out or having trouble signing in, email us from the address associated with your account.",
            },
            {
              q: "Content or generation issues",
              a: "If a generation failed and credits were deducted, include the generation ID (visible in your gallery) and we'll look into it.",
            },
            {
              q: "Reporting policy violations",
              a: "To report misuse or content that violates our Acceptable Use Policy, email us with as much detail as possible.",
            },
          ].map((item) => (
            <div key={item.q} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{item.q}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.a}</p>
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-16 flex flex-wrap gap-4 border-t border-[var(--border-subtle)] pt-8 text-xs text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-[var(--text-secondary)]">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[var(--text-secondary)]">Privacy Policy</Link>
          <Link href="/acceptable-use" className="hover:text-[var(--text-secondary)]">Acceptable Use</Link>
          <Link href="/" className="ml-auto hover:text-[var(--text-secondary)]">← Back to Artifacial</Link>
        </div>
      </div>
    </div>
  );
}
