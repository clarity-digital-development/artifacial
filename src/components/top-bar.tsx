"use client";

import { usePathname } from "next/navigation";
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
}

export function TopBar({ user, credits }: TopBarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const section =
    Object.entries(SECTION_NAMES).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? "Studio";

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

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-8">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {section}
      </span>
      <div className="flex items-center gap-5">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
        >
          <span className="text-sm font-medium text-[var(--accent-amber)]">{credits.toLocaleString()}</span>
          <span className="text-xs text-[var(--text-muted)]">credits</span>
        </Link>

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
            <div className="animate-fade-in-scale absolute right-0 top-full mt-2 w-56 origin-top-right rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
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
  );
}
