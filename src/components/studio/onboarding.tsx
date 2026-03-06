import Link from "next/link";

export function StudioOnboarding() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16">
      <div className="relative mb-12">
        <div className="absolute -inset-8 rounded-full bg-[var(--accent-amber)] opacity-[0.04] blur-[60px]" />
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-full border border-[var(--border-default)]" />
          <div className="absolute inset-3 rounded-full border border-[var(--border-subtle)]" />
          <div className="absolute inset-6 rounded-full border border-dashed border-[var(--accent-amber)]/20" />
          <div className="absolute inset-9 flex items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--accent-amber)]"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="font-display text-3xl font-bold text-[var(--text-primary)]">
        Cast your first character
      </h2>
      <p className="mt-4 max-w-md text-center leading-relaxed text-[var(--text-secondary)]">
        Upload a selfie or describe who you want to be.
        Your character will star in every video you create.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/characters/new?tab=photo"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 text-[var(--text-base)] font-semibold text-[var(--bg-deep)] shadow-[0_0_32px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_48px_rgba(232,166,52,0.25)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Upload Photo
        </Link>
        <Link
          href="/characters/new?tab=description"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-6 py-3 text-[var(--text-base)] font-medium text-[var(--text-primary)] transition-all duration-300 hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="17" y1="10" x2="3" y2="10" />
            <line x1="21" y1="6" x2="3" y2="6" />
            <line x1="21" y1="14" x2="3" y2="14" />
            <line x1="17" y1="18" x2="3" y2="18" />
          </svg>
          Describe Character
        </Link>
      </div>
    </div>
  );
}
