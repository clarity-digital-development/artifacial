"use client";

import { useEffect, useRef } from "react";

interface ReelItem {
  title: string;
  desc: string;
  video: string;
}

interface Props {
  items: ReelItem[];
  /** Index of the item to center on mount (default: middle). */
  initialIndex?: number;
}

export function MobileReel({ items, initialIndex }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centerIndex = initialIndex ?? Math.floor(items.length / 2);

  useEffect(() => {
    const container = scrollRef.current;
    const card = cardRefs.current[centerIndex];
    if (!container || !card) return;
    const target = card.offsetLeft + card.offsetWidth / 2 - container.clientWidth / 2;
    // Instant — no animation on mount
    container.scrollLeft = target;
  }, [centerIndex]);

  return (
    <div className="relative -mx-5 md:hidden">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide"
      >
        {/* Leading spacer so first card can center-snap */}
        <div className="w-[14vw] flex-shrink-0" aria-hidden />
        {items.map((item, i) => (
          <div
            key={item.title}
            ref={(el) => { cardRefs.current[i] = el; }}
            className="w-[72vw] flex-shrink-0 snap-center"
          >
            <ReelCard {...item} />
          </div>
        ))}
        {/* Trailing spacer so last card can center-snap */}
        <div className="w-[14vw] flex-shrink-0" aria-hidden />
      </div>

      {/* Edge fades — indicate scrollability */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[22vw] bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/85 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[22vw] bg-gradient-to-l from-[var(--bg-deep)] via-[var(--bg-deep)]/85 to-transparent"
      />
    </div>
  );
}

// ─── Card ───

function ReelCard({ title, desc, video }: ReelItem) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        src={video}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-display text-[12px] tracking-[0.01em] text-white">{title}</p>
        <p className="mt-0.5 text-[11px] text-white/60">{desc}</p>
      </div>
      <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
        <span className="h-1 w-1 rounded-full bg-[var(--accent-amber)]" />
      </div>
    </div>
  );
}
