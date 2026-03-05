"use client";

const ANGLE_LABELS = ["Front", "¾ Left", "¾ Right", "Full Body"];

interface CharacterPreviewGridProps {
  images: (string | null)[];
  generating: boolean;
  onRegenerateAngle?: (index: number) => void;
}

export function CharacterPreviewGrid({
  images,
  generating,
  onRegenerateAngle,
}: CharacterPreviewGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ANGLE_LABELS.map((label, i) => {
        const src = images[i];
        return (
          <div
            key={label}
            className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]"
          >
            {/* Viewfinder corner notches */}
            <div className="pointer-events-none absolute inset-0 z-10">
              <span className="absolute left-2 top-2 h-3 w-3 border-l border-t border-[var(--text-muted)]/40" />
              <span className="absolute right-2 top-2 h-3 w-3 border-r border-t border-[var(--text-muted)]/40" />
              <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[var(--text-muted)]/40" />
              <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[var(--text-muted)]/40" />
            </div>

            {src ? (
              <>
                <img
                  src={src}
                  alt={label}
                  className="h-full w-full object-cover animate-fade-in-scale"
                />
                {onRegenerateAngle && (
                  <button
                    type="button"
                    onClick={() => onRegenerateAngle(i)}
                    className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-deep)]/80 text-[var(--text-secondary)] opacity-0 transition-opacity duration-200 hover:text-[var(--accent-amber)] group-hover:opacity-100"
                    title="Regenerate this angle"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  </button>
                )}
              </>
            ) : generating ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-full w-full animate-amber-sweep bg-gradient-to-r from-[var(--bg-input)] via-[var(--accent-amber-glow)] to-[var(--bg-input)] bg-[length:200%_100%]" />
                <span className="absolute text-[var(--text-xs)] font-medium text-[var(--text-muted)]">
                  Generating...
                </span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                <span className="text-2xl text-[var(--text-muted)]">
                  {i + 1}
                </span>
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  {label}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
