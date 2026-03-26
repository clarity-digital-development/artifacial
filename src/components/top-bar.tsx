"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const SECTION_NAMES: Record<string, string> = {
  "/studio": "Studio",
  "/characters": "Characters",
  "/projects": "Projects",
  "/gallery": "Gallery",
  "/settings": "Settings",
};

interface TopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  credits: number;
  contentMode?: string;
  subscriptionTier?: string;
  hasDateOfBirth?: boolean;
}

export function TopBar({
  user,
  credits,
  contentMode = "SFW",
  subscriptionTier = "FREE",
  hasDateOfBirth = false,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [matureMode, setMatureMode] = useState(contentMode === "NSFW");
  const [toggling, setToggling] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const section =
    Object.entries(SECTION_NAMES).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? "Studio";

  const isFree = subscriptionTier === "FREE";

  const handleMatureToggle = async () => {
    if (toggling) return;

    if (matureMode) {
      // Disabling — immediate
      setToggling(true);
      try {
        const res = await fetch("/api/settings/content-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentMode: "SFW" }),
        });
        if (res.ok) {
          setMatureMode(false);
          router.refresh();
        }
      } finally {
        setToggling(false);
      }
    } else if (isFree) {
      setShowPaywall(true);
    } else if (hasDateOfBirth) {
      // Already age-verified — just enable
      setToggling(true);
      try {
        const res = await fetch("/api/settings/content-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentMode: "NSFW" }),
        });
        if (res.ok) {
          setMatureMode(true);
          router.refresh();
        }
      } finally {
        setToggling(false);
      }
    } else {
      // Need age verification — go to settings
      router.push("/settings");
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  // Sync with server state on prop change
  useEffect(() => {
    setMatureMode(contentMode === "NSFW");
  }, [contentMode]);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4 md:px-8">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {section}
        </span>
        <div className="flex items-center gap-4">
          {/* Mature content toggle */}
          <button
            onClick={handleMatureToggle}
            disabled={toggling}
            className={`group flex items-center gap-2 rounded-full px-2.5 py-1 transition-all duration-200 ${
              matureMode
                ? "bg-[var(--accent-amber)]/10 ring-1 ring-[var(--accent-amber)]/30"
                : "hover:bg-[var(--bg-elevated)]"
            }`}
            title={matureMode ? "Mature mode enabled — click to disable" : "Enable mature content mode"}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200 ${
              matureMode ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
            }`}>
              {matureMode ? "Mature" : "SFW"}
            </span>
            <div
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                matureMode ? "bg-[var(--accent-amber)]" : "bg-[var(--border-default)]"
              } ${toggling ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  matureMode ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </div>
            {isFree && !matureMode && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </button>

          {/* Divider */}
          <div className="hidden md:block h-4 w-px bg-[var(--border-subtle)]" />

          {/* Credits */}
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <span className="text-sm font-medium text-[var(--accent-amber)]">{credits.toLocaleString()}</span>
            <span className="hidden md:inline text-xs text-[var(--text-muted)]">credits</span>
          </Link>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-1.5 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? "User"}
                  className="h-7 w-7 rounded-full ring-1 ring-[var(--border-default)]"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-secondary)] ring-1 ring-[var(--border-default)]">
                  {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-[var(--text-muted)] transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {menuOpen && (
              <div className="animate-fade-in-scale absolute right-0 top-full z-[100] mt-2 w-56 origin-top-right rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                  {user.name && (
                    <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                  )}
                  {user.email && (
                    <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
                  )}
                </div>
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/sign-in" })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--accent-ember)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Paywall modal — Free tier */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-amber)]">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Unlock Creative Freedom
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Mature content is available on Starter ($15/mo) and above.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Maybe Later
              </button>
              <Link
                href="/pricing"
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-center text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
