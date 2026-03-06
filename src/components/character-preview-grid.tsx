"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) => {
          if (i === null) return null;
          const next = (i + 1) % 4;
          return images[next] ? next : i;
        });
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => {
          if (i === null) return null;
          const prev = (i + 3) % 4;
          return images[prev] ? prev : i;
        });
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, images, closeLightbox]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {ANGLE_LABELS.map((label, i) => {
          const src = images[i];
          return (
            <div
              key={label}
              className="group relative aspect-square w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
              onClick={() => src && setLightboxIndex(i)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerateAngle(i);
                      }}
                      className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-deep)]/80 text-[var(--text-secondary)] opacity-0 transition-opacity duration-200 hover:text-[var(--accent-amber)] group-hover:opacity-100"
                      title="Regenerate this angle"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    </button>
                  )}
                  {/* Label overlay */}
                  <span className="absolute bottom-2 left-2 z-10 rounded-[var(--radius-sm)] bg-[var(--bg-deep)]/70 px-2 py-0.5 text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">
                    {label}
                  </span>
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

      {/* Lightbox Modal */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div
            className="relative max-h-[85vh] max-w-[85vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex]!}
              alt={ANGLE_LABELS[lightboxIndex]}
              className="max-h-[85vh] max-w-[85vw] rounded-[var(--radius-lg)] object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)]"
            />
            {/* Label */}
            <span className="absolute bottom-4 left-4 rounded-[var(--radius-sm)] bg-[var(--bg-deep)]/80 px-3 py-1 text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              {ANGLE_LABELS[lightboxIndex]}
            </span>
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* Nav arrows */}
            {images[(lightboxIndex + 3) % 4] && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex + 3) % 4)}
                className="absolute left-[-48px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
            )}
            {images[(lightboxIndex + 1) % 4] && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex + 1) % 4)}
                className="absolute right-[-48px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
