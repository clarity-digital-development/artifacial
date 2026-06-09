"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  WORKSHOP_TOOLS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type WorkshopTool,
  type ToolCategory,
} from "@/lib/workshop/tools";

// ─── Favorites hook (localStorage-backed, per-device) ────────────────────────

const FAVORITES_KEY = "artifacial:workshop-favorites";

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setFavorites(new Set(arr.filter((s): s is string => typeof s === "string")));
      }
    } catch {
      // localStorage disabled / malformed — start empty
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { favorites, toggle, hydrated };
}

const ALL_CATEGORIES: { value: "all" | ToolCategory; label: string }[] = [
  { value: "all", label: "All tools" },
  { value: "preset", label: "Viral Presets" },
  { value: "video", label: "Video Tools" },
  { value: "face", label: "Face & Identity" },
  { value: "image", label: "Image Utilities" },
  { value: "audio", label: "Audio & Music" },
];

// Featured cards across the top — flagship tools that get prime real estate
const FEATURED: Array<{ slug: string; href: string; title: string; subtitle: string; badge?: string }> = [
  { slug: "marketing-studio",   href: "/marketing",                   title: "Marketing Studio",    subtitle: "Paste a product URL → ad video",         badge: "New" },
  { slug: "photodump",          href: "/workshop/photodump",          title: "Photodump",           subtitle: "12 cinematic scenes — one click",        badge: "Flagship" },
  { slug: "talking-avatar",     href: "/workshop/talking-avatar",     title: "Talking Avatar",      subtitle: "Photo + audio → premium speaking video", badge: "Premium" },
  { slug: "headshot-generator", href: "/workshop/headshot-generator", title: "Headshot Generator",  subtitle: "Selfie → 6 polished studio headshots",  badge: "Pro" },
];

function ToolCard({
  tool,
  isFavorite,
  onToggleFavorite,
}: {
  tool: WorkshopTool;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
}) {
  const href = tool.externalHref ?? `/workshop/${tool.slug}`;
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--bg-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/workshop-thumbs/${tool.slug}.webp`}
          alt={tool.name}
          className="relative z-[1] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 -z-0 flex items-center justify-center bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-deep)]">
          <span className="text-[var(--text-muted)] opacity-20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </span>
        </div>
        {tool.status === "beta" && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--accent-amber)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
            Beta
          </span>
        )}
        {/* Star — top-left, visible on hover and when already favorited */}
        <button
          type="button"
          aria-label={isFavorite ? "Unpin from favorites" : "Pin to favorites"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(tool.slug);
          }}
          className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
            isFavorite
              ? "bg-[var(--accent-amber)] text-black opacity-100"
              : "bg-black/40 text-white opacity-0 group-hover:opacity-100"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors">
            {tool.name}
          </h3>
          <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {tool.creditLabel}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{tool.tagline}</p>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent-amber)]">
          Open tool
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCard({ item }: { item: (typeof FEATURED)[number] }) {
  return (
    <Link
      href={item.href}
      className="group relative flex aspect-video flex-col justify-end overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--accent-amber)]/40 hover:shadow-[0_0_24px_rgba(232,166,52,0.15)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/workshop-thumbs/${item.slug}.webp`}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      {item.badge && (
        <span className="absolute right-3 top-3 rounded-full bg-[var(--accent-amber)]/85 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
          {item.badge}
        </span>
      )}
      <div className="relative p-4 sm:p-5">
        <h3 className="font-display text-base font-bold text-white sm:text-lg">{item.title}</h3>
        <p className="mt-0.5 text-[12px] text-white/75">{item.subtitle}</p>
      </div>
    </Link>
  );
}

function CategoryDropdown({ value, onChange }: { value: "all" | ToolCategory; onChange: (v: "all" | ToolCategory) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = ALL_CATEGORIES.find((c) => c.value === value)!;
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full sm:w-52 items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 text-sm transition-colors ${open ? "border-[var(--accent-amber)] bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]"}`}
      >
        <span>{selected.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-full sm:w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {ALL_CATEGORIES.map((c) => {
            const isActive = c.value === value;
            return (
              <button
                key={c.value}
                onClick={() => { onChange(c.value); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${isActive ? "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
              >
                {c.label}
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkshopClient({ totalCredits, tools: toolsProp }: { totalCredits: number; tools?: WorkshopTool[] }) {
  void totalCredits; // reserved for future header credit badge
  const tools = toolsProp ?? WORKSHOP_TOOLS;
  const [category, setCategory] = useState<"all" | ToolCategory>("all");
  const [query, setQuery] = useState("");
  const { favorites, toggle: toggleFavorite, hydrated: favoritesHydrated } = useFavorites();

  const searchActive = query.trim().length > 0;
  const pinnedTools = useMemo(
    () => tools.filter((t) => favorites.has(t.slug)),
    [tools, favorites],
  );

  const filtered = useMemo(() => {
    let list = tools;
    if (category !== "all") list = list.filter((t) => t.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.tagline.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tools, category, query]);

  // Hide featured row when actively filtering / searching — give the user pure results
  const showFeatured = !searchActive && category === "all";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Workshop
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Creative Tools</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {tools.length} AI-powered tool{tools.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Search */}
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] focus:outline-none sm:w-64"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <CategoryDropdown value={category} onChange={setCategory} />
        </div>
      </div>

      {/* Pinned (favorites) — appears above Featured when user has pinned tools */}
      {favoritesHydrated && pinnedTools.length > 0 && !searchActive && category === "all" && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-amber)]">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pinned · <span className="text-[var(--text-secondary)]">{pinnedTools.length}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} isFavorite={favorites.has(tool.slug)} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        </section>
      )}

      {/* Featured row — hidden while filtering or searching */}
      {showFeatured && (
        <section className="mb-8">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Featured
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {FEATURED.map((item) => (
              <FeaturedCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Results / grouped grid */}
      {searchActive ? (
        filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No tools match &quot;{query}&quot;.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-[var(--text-muted)]">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tool) => <ToolCard key={tool.slug} tool={tool} isFavorite={favorites.has(tool.slug)} onToggleFavorite={toggleFavorite} />)}
            </div>
          </>
        )
      ) : category === "all" ? (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const catTools = tools.filter((t) => t.category === cat);
            if (catTools.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {CATEGORY_LABELS[cat]} · <span className="text-[var(--text-secondary)]">{catTools.length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catTools.map((tool) => <ToolCard key={tool.slug} tool={tool} isFavorite={favorites.has(tool.slug)} onToggleFavorite={toggleFavorite} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => <ToolCard key={tool.slug} tool={tool} isFavorite={favorites.has(tool.slug)} onToggleFavorite={toggleFavorite} />)}
        </div>
      )}
    </div>
  );
}
