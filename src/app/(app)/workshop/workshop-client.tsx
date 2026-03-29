"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  WORKSHOP_TOOLS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type WorkshopTool,
  type ToolCategory,
} from "@/lib/workshop/tools";

const ALL_CATEGORIES: { value: "all" | ToolCategory; label: string }[] = [
  { value: "all", label: "All Tools" },
  { value: "face", label: "Face & Identity" },
  { value: "video", label: "Video Tools" },
  { value: "image", label: "Image Utilities" },
  { value: "audio", label: "Audio & Music" },
];

function ToolCard({ tool }: { tool: WorkshopTool }) {
  return (
    <Link
      href={`/workshop/${tool.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--bg-deep)]">
        <img
          src={`/workshop-thumbs/${tool.slug}.webp`}
          alt={tool.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(e) => {
            // Fallback: hide broken img and show placeholder
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Placeholder gradient (shows under img; visible when img fails/loads) */}
        <div className="absolute inset-0 -z-0 flex items-center justify-center bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-deep)]">
          <span className="text-[var(--text-muted)] opacity-20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </span>
        </div>

        {/* Status badge */}
        {tool.status === "beta" && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--accent-amber)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
            Beta
          </span>
        )}
      </div>

      {/* Info */}
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

        {/* Open button */}
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

function CategoryDropdown({
  value,
  onChange,
}: {
  value: "all" | ToolCategory;
  onChange: (v: "all" | ToolCategory) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = ALL_CATEGORIES.find((c) => c.value === value)!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full sm:w-48 items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 text-sm transition-colors ${
          open
            ? "border-[var(--accent-amber)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
        }`}
      >
        <span>{selected.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-full sm:w-48 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {ALL_CATEGORIES.map((c) => {
            const isActive = c.value === value;
            return (
              <button
                key={c.value}
                onClick={() => { onChange(c.value); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`}
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

export function WorkshopClient({ totalCredits }: { totalCredits: number }) {
  const [category, setCategory] = useState<"all" | ToolCategory>("all");

  const filtered =
    category === "all"
      ? WORKSHOP_TOOLS
      : WORKSHOP_TOOLS.filter((t) => t.category === category);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Workshop
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Creative Tools
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {WORKSHOP_TOOLS.length} AI-powered tools for every creative need
          </p>
        </div>

        {/* Category filter */}
        <CategoryDropdown value={category} onChange={setCategory} />
      </div>

      {/* Grouped layout (All) */}
      {category === "all" ? (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const tools = WORKSHOP_TOOLS.filter((t) => t.category === cat);
            return (
              <section key={cat}>
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Filtered flat grid */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      )}

      {/* Coming soon banner */}
      <div className="mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="relative flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-12">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--accent-amber)]/5 to-transparent" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent-amber)]">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
              Coming Soon
            </p>
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              19 more custom tools
            </h3>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              Coming soon to Artifacial — face swap, lip sync, upscale, style transfer, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
