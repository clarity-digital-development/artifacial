import Link from "next/link";

export function StudioOnboarding() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      {/* Abstract shape — concentric rings with amber glow */}
      <div className="relative mb-10">
        <div className="h-28 w-28 rounded-full border border-[var(--border-default)]" />
        <div className="absolute inset-2 rounded-full border border-[var(--border-subtle)]" />
        <div className="absolute inset-5 rounded-full border border-dashed border-[var(--accent-amber)]/30" />
        <div className="absolute inset-8 flex items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
          <svg
            width="28"
            height="28"
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

      <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Cast your first character
      </h2>
      <p className="mt-3 max-w-md text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
        Upload a selfie or describe who you want to be.
        Your character will star in every video you create.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/characters/new?tab=photo"
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-[var(--text-base)] font-medium text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)]"
        >
          Upload Photo
        </Link>
        <Link
          href="/characters/new?tab=description"
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-[var(--text-base)] font-medium text-[var(--text-primary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
        >
          Describe Character
        </Link>
      </div>
    </div>
  );
}
