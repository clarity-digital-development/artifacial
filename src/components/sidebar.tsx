"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { type ReactNode, useState, useEffect, useRef } from "react";

function IconStudio({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconCharacters({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconGenerate({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconWorkshop({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconGallery({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const NAV_ITEMS: { href: string; label: string; icon: (props: { className?: string }) => ReactNode }[] = [
  { href: "/studio", label: "Studio", icon: IconStudio },
  { href: "/characters", label: "Characters", icon: IconCharacters },
  { href: "/gallery", label: "Gallery", icon: IconGallery },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

interface SidebarProps {
  contentMode?: string;
}

export function Sidebar({ contentMode }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isNsfw = contentMode === "NSFW";
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const createIsActive =
    pathname.startsWith("/generate") || pathname.startsWith("/workshop");

  // Close dropdown on outside click
  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [createOpen]);

  // Close on route change
  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  return (
    <aside className="relative z-30 hidden md:flex h-full w-[72px] flex-col items-center border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6">
      <Link
        href="/studio"
        className="mb-10 flex h-9 w-9 items-center justify-center"
      >
        <Image src="/logo.svg" alt="Artifacial" width={36} height={36} unoptimized />
      </Link>

      <nav className="flex flex-1 flex-col gap-2">
        {/* Create button with dropdown */}
        <div ref={createRef} className="relative">
          <button
            onClick={() => setCreateOpen((o) => !o)}
            title="Create"
            className={`relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              createIsActive
                ? "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] shadow-[0_0_12px_rgba(232,166,52,0.1)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            <IconGenerate />
          </button>

          {createOpen && (
            <div className="absolute left-[calc(100%+10px)] top-0 z-50 min-w-[168px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
              {/* Small arrow indicator */}
              <div className="absolute -left-[5px] top-3 h-2.5 w-2.5 rotate-45 border-b border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
              <button
                onClick={() => { setCreateOpen(false); router.push("/generate"); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <IconGenerate className="shrink-0 opacity-70" />
                <span className="font-medium">Generate</span>
              </button>
              <div className="mx-3 h-px bg-[var(--border-subtle)]" />
              <button
                onClick={() => { setCreateOpen(false); router.push("/workshop"); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <IconWorkshop className="shrink-0 opacity-70" />
                <span className="font-medium">Workshop</span>
              </button>
            </div>
          )}
        </div>

        {/* Regular nav items */}
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                  ? "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] shadow-[0_0_12px_rgba(232,166,52,0.1)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
              title={item.label}
            >
              <Icon />
              {isNsfw && item.href === "/settings" && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--accent-amber)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/sign-in" })}
        className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        title="Sign out"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </aside>
  );
}
