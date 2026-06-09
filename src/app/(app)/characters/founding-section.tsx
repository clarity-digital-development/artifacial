"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface FoundingChar {
  slug: string;
  name: string;
  persona: string;
  description: string;
  style: string;
  imageUrl: string;
}

interface Props {
  /** When true the section is collapsed by default into a single CTA button.
   *  When false it renders as a primary featured grid (used when user has 0 characters). */
  compact: boolean;
}

export function FoundingCharactersSection({ compact }: Props) {
  const [chars, setChars] = useState<FoundingChar[] | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [cloning, setCloning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!expanded || chars !== null) return;
    fetch("/api/characters/founding")
      .then((r) => r.json())
      .then((data) => setChars(data.characters ?? []))
      .catch(() => setError("Could not load founding characters"));
  }, [expanded, chars]);

  const handleClone = async (slug: string) => {
    setCloning(slug);
    setError(null);
    try {
      const res = await fetch("/api/characters/founding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add character");
      router.push(`/characters/${data.character.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add character");
      setCloning(null);
    }
  };

  // Compact mode = small CTA banner that expands on click
  if (compact && !expanded) {
    return (
      <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Browse 12 starter characters</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
              Magazine-quality portraits across personas. Add any one to your library in a click.
            </p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Starter characters
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pick a pre-made character to jump straight into generating, or create your own.
          </p>
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[11px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
          >
            Collapse
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-[12px] text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(chars ?? Array.from({ length: 12 })).map((c, idx) => {
          const slug = (c as FoundingChar | undefined)?.slug ?? String(idx);
          const isCloning = (c as FoundingChar)?.slug && cloning === (c as FoundingChar).slug;
          return (
            <button
              key={slug}
              onClick={() => {
                if (chars && (c as FoundingChar).slug && !cloning) handleClone((c as FoundingChar).slug);
              }}
              disabled={!chars || !!cloning}
              className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-left transition-all hover:border-[var(--accent-amber)]/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {chars && (c as FoundingChar).imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={(c as FoundingChar).imageUrl}
                  alt={(c as FoundingChar).name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-[var(--bg-elevated)]" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2.5">
                {chars && (
                  <>
                    <p className="text-sm font-semibold text-white">{(c as FoundingChar).name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/70">
                      {(c as FoundingChar).persona}
                    </p>
                  </>
                )}
              </div>
              {isCloning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                </div>
              )}
              <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-amber)] opacity-0 transition-opacity group-hover:opacity-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
