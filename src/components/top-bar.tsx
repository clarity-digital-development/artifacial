"use client";

import { usePathname } from "next/navigation";

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
  const section =
    Object.entries(SECTION_NAMES).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? "Studio";

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-8">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {section}
      </span>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1 text-[var(--text-xs)]">
          <span className="font-medium text-[var(--accent-amber)]">{credits.toLocaleString()}</span>
          <span className="text-[var(--text-muted)]">credits</span>
        </div>
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? "User"}
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)]">
            {user.name?.[0] ?? "U"}
          </div>
        )}
      </div>
    </header>
  );
}
