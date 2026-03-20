"use client";

import { useState, useEffect, useCallback } from "react";

interface CharacterPreviewGridProps {
  images: (string | null)[];
  generating: boolean;
  onRegenerateAngle?: (index: number) => void;
}

export function CharacterPreviewGrid({
  images,
  generating,
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
          const next = (i + 1) % images.length;
          return images[next] ? next : i;
        });
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => {
          if (i === null) return null;
          const prev = (i + images.length - 1) % images.length;
          return images[prev] ? prev : i;
        });
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, images, closeLightbox]);

  return (
    <>
      <div className={`grid gap-3 ${
        images.length === 1 ? "grid-cols-1 max-w-xs mx-auto" :
        images.length === 2 ? "grid-cols-2 max-w-lg mx-auto" :
        "grid-cols-4"
      }`}>
        {images.map((src, i) => (
          <div
            key={i}
            className="group relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-input)] cursor-pointer transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
            onClick={() => src && setLightboxIndex(i)}
          >
            {src ? (
              <>
                <img
                  src={src}
                  alt={`Generated ${i + 1}`}
                  className="h-full w-full object-cover animate-fade-in-scale transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute bottom-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-deep)]/70 text-[10px] font-semibold text-[var(--text-secondary)]">
                  {i + 1}
                </span>
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-[var(--accent-amber)]/60" />
                  <span className="absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-[var(--accent-amber)]/60" />
                  <span className="absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-[var(--accent-amber)]/60" />
                  <span className="absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-[var(--accent-amber)]/60" />
                </div>
              </>
            ) : generating ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-full w-full animate-amber-sweep bg-gradient-to-r from-[var(--bg-input)] via-[var(--accent-amber-glow)] to-[var(--bg-input)] bg-[length:200%_100%]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-amber)]/20 border-t-[var(--accent-amber)]" />
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">Generating</span>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--border-default)]">
                  <span className="text-sm font-medium text-[var(--text-muted)]">{i + 1}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div className="relative max-h-[85vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIndex]!}
              alt={`Generated ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-[85vw] rounded-[var(--radius-lg)] object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)]"
            />
            <button
              onClick={closeLightbox}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {images[(lightboxIndex + images.length - 1) % images.length] && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex + images.length - 1) % images.length)}
                className="absolute left-[-48px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
            )}
            {images[(lightboxIndex + 1) % images.length] && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
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
