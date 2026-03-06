"use client";

import { useState } from "react";
import Link from "next/link";

interface GalleryItem {
  id: string;
  name: string;
  prompt: string | null;
  videoUrl: string | null;
  characterName: string | null;
  characterThumbnail: string | null;
  completedAt: string;
}

export function GalleryClient({ items }: { items: GalleryItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
        >
          <div className="relative aspect-video overflow-hidden bg-black">
            {item.videoUrl ? (
              <video
                src={item.videoUrl}
                className="h-full w-full object-cover"
                controls
                preload="metadata"
                playsInline
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                Video unavailable
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${item.id}`}
                  className="block truncate text-sm font-medium text-[var(--text-primary)] transition-colors duration-200 hover:text-[var(--accent-amber)]"
                >
                  {item.name}
                </Link>
                <div className="mt-1.5 flex items-center gap-3">
                  {item.characterName && (
                    <div className="flex items-center gap-1.5">
                      {item.characterThumbnail ? (
                        <img
                          src={item.characterThumbnail}
                          alt={item.characterName}
                          className="h-4 w-4 rounded-full object-cover ring-1 ring-[var(--border-subtle)]"
                        />
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[8px] text-[var(--text-muted)]">
                          {item.characterName[0]}
                        </div>
                      )}
                      <span className="text-xs text-[var(--text-secondary)]">
                        {item.characterName}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(item.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                Complete
              </span>
            </div>

            {item.prompt && (
              <button
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                className="mt-3 w-full text-left"
              >
                <p
                  className={`text-xs leading-relaxed text-[var(--text-muted)] ${
                    expandedId === item.id ? "" : "line-clamp-2"
                  }`}
                >
                  {item.prompt}
                </p>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
