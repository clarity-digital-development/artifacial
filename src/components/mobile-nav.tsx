"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const STATIC_NAV_ITEMS = [
  {
    href: "/studio",
    label: "Studio",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    href: "/characters",
    label: "Characters",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/gallery",
    label: "Gallery",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      </svg>
    ),
  },
];

const IconGenerate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconWorkshop = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setCreateOpen(false); }, [pathname]);

  const createIsActive =
    pathname === "/generate" ||
    pathname.startsWith("/generate/") ||
    pathname === "/workshop" ||
    pathname.startsWith("/workshop/");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {/* Studio, Characters */}
        {STATIC_NAV_ITEMS.slice(0, 2).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/studio" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors active:opacity-70 ${
                isActive ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"
              }`}
            >
              <span className={isActive ? "text-[var(--accent-amber)]" : "text-[var(--text-secondary)]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        {/* Create — opens sheet */}
        <button
          onClick={() => setCreateOpen(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors active:opacity-70 ${
            createIsActive ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"
          }`}
        >
          <span className={createIsActive ? "text-[var(--accent-amber)]" : "text-[var(--text-secondary)]"}>
            <IconGenerate />
          </span>
          Create
        </button>

        {/* Gallery, Settings */}
        {STATIC_NAV_ITEMS.slice(2).map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors active:opacity-70 ${
                isActive ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"
              }`}
            >
              <span className={isActive ? "text-[var(--accent-amber)]" : "text-[var(--text-secondary)]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Create options sheet — portaled to body */}
      {mounted && createOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center md:hidden"
          onClick={() => setCreateOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative z-10 mx-4 mb-[calc(64px+env(safe-area-inset-bottom))] w-full max-w-xs overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pb-0 pt-3.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Create
            </p>
            <button
              onClick={() => { setCreateOpen(false); router.push("/generate"); }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]">
                <IconGenerate />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Generate</p>
                <p className="text-xs text-[var(--text-muted)]">Create videos & images with AI</p>
              </div>
            </button>
            <div className="mx-4 h-px bg-[var(--border-subtle)]" />
            <button
              onClick={() => { setCreateOpen(false); router.push("/workshop"); }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 pb-4 text-left transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                <IconWorkshop />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Workshop</p>
                <p className="text-xs text-[var(--text-muted)]">Face swap, effects, music & more</p>
              </div>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
