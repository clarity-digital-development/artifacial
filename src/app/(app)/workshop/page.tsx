export const metadata = {
  title: "Workshop — Artifacial",
};

export default function WorkshopPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent-amber)]">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>

      {/* Label */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
        Coming Soon
      </p>

      {/* Heading */}
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
        Workshop
      </h1>

      {/* Subtext */}
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
        19 custom AI tools — face swap, lip sync, upscale, style transfer, and more — coming soon to Artifacial.
      </p>
    </div>
  );
}
