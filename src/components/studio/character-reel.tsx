"use client";

import Link from "next/link";
import { useRef } from "react";
import { Card } from "@/components/ui";

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
    const amount = 280;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
          Recent Characters
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href="/characters"
            className="text-[var(--text-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--accent-amber)]"
          >
            View All
          </Link>
          <div className="flex gap-1">
            <button
              onClick={() => scroll("left")}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Scroll left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Scroll right"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {/* New character card */}
        <Link href="/characters/new" className="shrink-0 snap-start">
          <Card
            hover
            className="flex h-[240px] w-[180px] flex-col items-center justify-center gap-3 border-dashed"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)] text-xl text-[var(--accent-amber)]">
              +
            </span>
            <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">
              New Character
            </span>
          </Card>
        </Link>

        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/characters/${character.id}`}
            className="shrink-0 snap-start"
          >
            <Card hover className="h-[240px] w-[180px] overflow-hidden">
              <div className="relative h-[190px] bg-[var(--bg-input)]">
                {character.thumbnailUrl ? (
                  <img
                    src={character.thumbnailUrl}
                    alt={character.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-display text-3xl text-[var(--text-muted)]">
                      {character.name[0]}
                    </span>
                  </div>
                )}
                {/* Viewfinder corners */}
                <div className="pointer-events-none absolute inset-0">
                  <span className="absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-[var(--text-muted)]/30" />
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-[var(--text-muted)]/30" />
                  <span className="absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-[var(--text-muted)]/30" />
                  <span className="absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-[var(--text-muted)]/30" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <p className="flex-1 truncate text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  {character.name}
                </p>
                <span className="shrink-0 text-[var(--text-xs)] capitalize text-[var(--text-muted)]">
                  {character.style}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
