"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PublicCharacter {
  id: string;
  name: string;
  style: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  cloneCount: number;
  creatorName: string;
}

export function CommunityCharactersClient() {
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const router = useRouter();

  const fetchPage = useCallback(async (opts: { cursor?: string | null; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.q) params.set("q", opts.q);
    const res = await fetch(`/api/characters/community?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load community characters");
    return (await res.json()) as { characters: PublicCharacter[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage({ q: query.trim() || undefined })
      .then((data) => {
        if (cancelled) return;
        setCharacters(data.characters);
        setCursor(data.nextCursor);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query, fetchPage]);

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage({ cursor, q: query.trim() || undefined });
      setCharacters((prev) => [...prev, ...data.characters]);
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleClone = async (id: string) => {
    setCloning(id);
    setError(null);
    try {
      const res = await fetch(`/api/characters/community/${id}/clone`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not clone");
      router.push(`/characters/${data.character.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clone");
      setCloning(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Community
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Characters from the Artifacial community
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Browse characters published by other creators. Add any one to your library in one click.
          </p>
        </div>
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters…"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-[12px] text-red-400">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {query ? `No characters match "${query}".` : "No public characters yet. Be the first to publish one from your library."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {characters.map((c) => (
              <div key={c.id} className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                {c.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={c.imageUrl} alt={c.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-display text-3xl text-[var(--text-muted)]">{c.name[0]}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/65">
                    by {c.creatorName}{c.cloneCount > 0 ? ` · ${c.cloneCount} clone${c.cloneCount === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleClone(c.id)}
                  disabled={!!cloning}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-amber)] text-black opacity-0 transition-opacity hover:opacity-90 group-hover:opacity-100 disabled:opacity-50"
                  aria-label={`Add ${c.name} to library`}
                >
                  {cloning === c.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-subtle)] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
