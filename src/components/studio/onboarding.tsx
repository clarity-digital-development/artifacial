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
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="m10 8 5 3-5 3z" />
              <line x1="2" y1="21" x2="22" y2="21" />
              <line x1="7" y1="17" x2="7" y2="21" />
              <line x1="17" y1="17" x2="17" y2="21" />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="font-display text-3xl font-bold text-[var(--text-primary)]">
        Create your first video
      </h2>
      <p className="mt-4 max-w-md text-center leading-relaxed text-[var(--text-secondary)]">
        Describe a scene, pick a model, and generate a video in seconds.
        Or create a character first to use in face swaps.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 text-[var(--text-base)] font-semibold text-[var(--bg-deep)] shadow-[0_0_32px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_48px_rgba(232,166,52,0.25)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="m10 8 5 3-5 3z" />
            <line x1="2" y1="21" x2="22" y2="21" />
            <line x1="7" y1="17" x2="7" y2="21" />
            <line x1="17" y1="17" x2="17" y2="21" />
          </svg>
          Start Generating
        </Link>
        <Link
          href="/characters/new"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-6 py-3 text-[var(--text-base)] font-medium text-[var(--text-primary)] transition-all duration-300 hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Create Character
        </Link>
      </div>
    </div>
  );
}
