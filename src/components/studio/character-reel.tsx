"use client";

import Link from "next/link";
import { useRef } from "react";

interface CharacterCard {
  id: string;
  name: string;
  style: string;
  thumbnailUrl: string | null;
}

export function CharacterReel({ characters }: { characters: CharacterCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Characters
          </h2>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {characters.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/characters"
            className="mr-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-amber)]"
          >
            View All
          </Link>
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
            aria-label="Scroll left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
            aria-label="Scroll right"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        <Link href="/characters/new" className="shrink-0 snap-start">
          <div className="group flex h-[260px] w-[190px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--accent-amber)]/40 hover:bg-[var(--bg-elevated)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/40 text-[var(--accent-amber)] transition-all duration-300 group-hover:border-[var(--accent-amber)] group-hover:bg-[var(--accent-amber-glow)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              New Character
            </span>
          </div>
        </Link>

        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/characters/${character.id}`}
            className="shrink-0 snap-start"
          >
            <div className="group h-[260px] w-[190px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <div className="relative h-[200px] overflow-hidden bg-[var(--bg-input)]">
                {character.thumbnailUrl ? (
                  <img
                    src={character.thumbnailUrl}
                    alt={character.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-display text-4xl text-[var(--text-muted)]">
                      {character.name[0]}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--bg-surface)] to-transparent" />
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[var(--accent-amber)]/50" />
                  <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[var(--accent-amber)]/50" />
                  <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[var(--accent-amber)]/50" />
                  <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[var(--accent-amber)]/50" />
                </div>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {character.name}
                </p>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {character.style}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
