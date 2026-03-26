# Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire app usable on mobile (< 768px) — sidebar collapses to bottom nav, /generate gets a bottom-sheet workflow, /studio switches to grid albums, and the landing page gets a mobile nav + working video playback.

**Architecture:** Mobile-first responsive approach using a `useIsMobile()` hook and Tailwind `md:` breakpoints. The sidebar becomes a bottom tab bar on mobile. The /generate page extracts settings into a shared component rendered in either a sidebar (desktop) or bottom sheet (mobile). The desktop right panel is eliminated entirely and replaced with inline GenerationDetailsCard on all screen sizes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, CSS custom properties from globals.css

**Design spec:** `docs/superpowers/specs/2026-03-26-studio-mobile-redesign-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/hooks/use-is-mobile.ts` | `useIsMobile()` hook — `matchMedia('(max-width: 768px)')` |
| `src/components/mobile-nav.tsx` | Bottom tab bar for mobile (replaces sidebar) |
| `src/components/generate/settings-content.tsx` | Extracted settings panel content (tabs, model, prompt, pills, generate button) |
| `src/components/generate/settings-sheet.tsx` | Mobile bottom sheet container (backdrop, drag handle, slide animation, drag-to-dismiss) |
| `src/components/generate/generation-details-card.tsx` | Inline details card (prompt, metadata, actions) — used on both desktop and mobile |
| `src/components/generate/bottom-button.tsx` | Sticky "New Generation" CTA for mobile |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(app)/layout.tsx` | Conditionally render Sidebar (desktop) vs MobileNav (mobile), adjust padding |
| `src/components/sidebar.tsx` | Hide on mobile via `hidden md:flex` |
| `src/components/top-bar.tsx` | Reduce padding on mobile, compact layout |
| `src/app/(app)/generate/generate-client.tsx` | Replace three-panel layout with two-panel desktop + single-panel mobile, use extracted components |
| `src/app/(app)/studio/page.tsx` | Hide QuickCreateBar on mobile, switch carousels to grid albums |
| `src/components/studio/character-reel.tsx` | Add grid layout mode for mobile |
| `src/components/studio/recent-generations.tsx` | Add grid layout mode for mobile |
| `src/app/page.tsx` | Show mobile nav bar, fix video playback |

---

## Task 1: useIsMobile Hook

**Files:**
- Create: `src/hooks/use-is-mobile.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-is-mobile.ts
"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Commit**

```
git add src/hooks/use-is-mobile.ts
git commit -m "feat: add useIsMobile hook for responsive layout switching"
```

---

## Task 2: Mobile Bottom Navigation

Replace the 72px sidebar with a bottom tab bar on mobile screens.

**Files:**
- Create: `src/components/mobile-nav.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/top-bar.tsx`

- [ ] **Step 1: Create MobileNav component**

```tsx
// src/components/mobile-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/studio", label: "Studio", icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )},
  { href: "/characters", label: "Characters", icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )},
  { href: "/generate", label: "Create", icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )},
  { href: "/gallery", label: "Gallery", icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )},
  { href: "/settings", label: "Settings", icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    </svg>
  )},
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? "text-[var(--accent-amber)]"
                : "text-[var(--text-muted)]"
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
  );
}
```

- [ ] **Step 2: Hide desktop sidebar on mobile**

In `src/components/sidebar.tsx`, change the `<aside>` className:

```tsx
// Before:
<aside className="flex h-full w-[72px] flex-col items-center border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6">

// After:
<aside className="hidden md:flex h-full w-[72px] flex-col items-center border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6">
```

- [ ] **Step 3: Update app layout to include MobileNav**

In `src/app/(app)/layout.tsx`, add the MobileNav and adjust main padding:

```tsx
import { MobileNav } from "@/components/mobile-nav";

// In the return JSX, add MobileNav and adjust main padding:
return (
  <div className="grain ambient-light flex h-screen bg-[var(--bg-deep)]">
    <Sidebar contentMode={contentMode} />
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
      <TopBar
        user={session?.user ?? { name: "Preview", email: "preview@test.com" }}
        credits={totalCredits}
        contentMode={contentMode}
        subscriptionTier={subscriptionTier}
        hasDateOfBirth={hasDateOfBirth}
      />
      <main className="stagger-reveal flex-1 overflow-y-auto px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-6 lg:px-12">
        {children}
      </main>
    </div>
    <MobileNav />
  </div>
);
```

Key changes:
- `px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-6` — tighter mobile padding, extra bottom padding for the nav bar
- `<MobileNav />` added at the end (it self-hides on desktop via `md:hidden`)

- [ ] **Step 4: Compact TopBar on mobile**

In `src/components/top-bar.tsx`, adjust the header padding and hide the divider:

```tsx
// Before:
<header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-8">

// After:
<header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4 md:px-8">
```

Also hide the text "credits" label on mobile and the divider:

```tsx
// Divider — hide on mobile:
<div className="hidden md:block h-4 w-px bg-[var(--border-subtle)]" />

// Credits — compact on mobile:
<span className="text-sm font-medium text-[var(--accent-amber)]">{credits.toLocaleString()}</span>
<span className="hidden md:inline text-xs text-[var(--text-muted)]">credits</span>
```

- [ ] **Step 5: Commit**

```
git add src/components/mobile-nav.tsx src/components/sidebar.tsx src/app/(app)/layout.tsx src/components/top-bar.tsx
git commit -m "feat: add mobile bottom navigation, hide sidebar on mobile, compact top bar"
```

---

## Task 3: GenerationDetailsCard Component

Shared component used on both desktop and mobile to display generation metadata inline below each output. Replaces the desktop right panel.

**Files:**
- Create: `src/components/generate/generation-details-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/generate/generation-details-card.tsx
"use client";

type GenerationDetailsCardProps = {
  prompt: string;
  modelName: string;
  durationSec: number;
  resolution?: string;
  withAudio: boolean;
  creditCost: number;
  status: "submitting" | "queued" | "processing" | "completed" | "failed";
  errorMessage?: string;
  createdAt: number;
  generationTimeMs?: number;
  outputUrl?: string;
  onRegenerate?: () => void;
  onDownload?: () => void;
};

export function GenerationDetailsCard({
  prompt,
  modelName,
  durationSec,
  resolution,
  withAudio,
  creditCost,
  status,
  errorMessage,
  createdAt,
  generationTimeMs,
  outputUrl,
  onRegenerate,
  onDownload,
}: GenerationDetailsCardProps) {
  const time = new Date(createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-4 mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 md:mx-0">
      {/* Prompt */}
      <p className="text-sm text-[var(--text-secondary)]">{prompt}</p>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>{modelName}</span>
        <span>&middot;</span>
        {resolution && (
          <>
            <span>{resolution}</span>
            <span>&middot;</span>
          </>
        )}
        <span>{durationSec}s</span>
        <span>&middot;</span>
        <span>Audio: {withAudio ? "Yes" : "No"}</span>
        <span>&middot;</span>
        <span className="text-[var(--accent-amber)]">{creditCost.toLocaleString()} cr</span>
        {generationTimeMs && (
          <>
            <span>&middot;</span>
            <span>{(generationTimeMs / 1000).toFixed(1)}s</span>
          </>
        )}
        <span>&middot;</span>
        <span>{time}</span>
      </div>

      {/* Error */}
      {status === "failed" && errorMessage && (
        <p className="mt-2 text-xs text-[var(--error)]">{errorMessage}</p>
      )}

      {/* Actions */}
      {status === "completed" && (
        <div className="mt-3 flex gap-2">
          {outputUrl && onDownload && (
            <button
              onClick={onDownload}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Download
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/generate/generation-details-card.tsx
git commit -m "feat: add GenerationDetailsCard component for inline generation metadata"
```

---

## Task 4: Settings Sheet + Bottom Button (Mobile /generate)

The bottom sheet with drag-to-dismiss and the sticky "New Generation" button.

**Files:**
- Create: `src/components/generate/settings-sheet.tsx`
- Create: `src/components/generate/bottom-button.tsx`

- [ ] **Step 1: Create BottomButton**

```tsx
// src/components/generate/bottom-button.tsx
"use client";

type BottomButtonProps = {
  isGenerating: boolean;
  onClick: () => void;
};

export function BottomButton({ isGenerating, onClick }: BottomButtonProps) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-[env(safe-area-inset-bottom)] md:hidden">
      <button
        onClick={onClick}
        disabled={isGenerating}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--accent-amber)] text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.2)] transition-all duration-200 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Generation
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create SettingsSheet**

```tsx
// src/components/generate/settings-sheet.tsx
"use client";

import { useRef, useCallback, useEffect, type ReactNode } from "react";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsSheet({ open, onClose, children }: SettingsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const currentTranslateY = useRef(0);

  // Drag-to-dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start drag from the handle area (top 40px of sheet)
    const touch = e.touches[0];
    const sheetTop = sheetRef.current?.getBoundingClientRect().top ?? 0;
    if (touch.clientY - sheetTop < 40) {
      dragStartY.current = touch.clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    if (deltaY > 0) {
      currentTranslateY.current = deltaY;
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null || !sheetRef.current) return;
    if (currentTranslateY.current > 100) {
      onClose();
    } else {
      sheetRef.current.style.transform = "translateY(0)";
      sheetRef.current.style.transition = "transform 200ms ease-out";
      setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.transition = "";
      }, 200);
    }
    dragStartY.current = null;
    currentTranslateY.current = 0;
  }, [onClose]);

  // Reset transform when opening
  useEffect(() => {
    if (open && sheetRef.current) {
      sheetRef.current.style.transform = "translateY(0)";
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 md:hidden ${
          open ? "opacity-50 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-transform duration-300 md:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center bg-[var(--bg-surface)] pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Content */}
        <div className="px-4 pb-6">
          {children}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/components/generate/settings-sheet.tsx src/components/generate/bottom-button.tsx
git commit -m "feat: add mobile settings sheet with drag-to-dismiss and bottom button"
```

---

## Task 5: Extract StudioSettingsContent

Extract all the settings panel controls from generate-client.tsx into a shared component that both the desktop sidebar and mobile sheet can render.

**Files:**
- Create: `src/components/generate/settings-content.tsx`

- [ ] **Step 1: Create the component**

This component receives all the form state and callbacks as props. It renders the tab row, model selector, audio toggle, prompt textarea, image uploads, duration/aspect/resolution pills, and generate button.

The exact JSX is extracted from `generate-client.tsx` lines 582-1183 (the entire left panel content). The component signature:

```tsx
// src/components/generate/settings-content.tsx
"use client";

import { type ReactNode } from "react";
import { UploadZone } from "@/components/upload-zone";

// Re-export types needed by parent
export type ModeTab = "T2V" | "I2V" | "MOTION_TRANSFER";
export type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";

type SettingsContentProps = {
  // Mode tabs
  mode: ModeTab;
  onModeChange: (mode: ModeTab) => void;
  showMotionTab: boolean;

  // Model
  selectedModelId: string;
  onModelChange: (id: string) => void;
  modelSelectorContent: ReactNode; // The model dropdown JSX (complex, stays in parent)

  // Audio
  supportsAudio: boolean;
  withAudio: boolean;
  onAudioChange: (v: boolean) => void;
  audioAddonCredits: number;

  // Prompt
  prompt: string;
  onPromptChange: (v: string) => void;
  maxPromptLength: number;

  // Uploads (I2V / Motion) — passed as render slots since they're complex
  uploadContent: ReactNode | null;

  // Settings pills — passed as render slot
  settingsPillsContent: ReactNode;

  // Generate
  creditCost: number;
  canAfford: boolean;
  isGenerating: boolean;
  onGenerate: () => void;

  // Layout context
  isMobile: boolean;
};
```

The component renders these sections top to bottom:
1. Tab row (T2V / I2V / Motion)
2. Model selector (render slot from parent — too complex to extract fully)
3. Audio toggle (if supported)
4. Prompt textarea with char count
5. Upload content (render slot — I2V image picker, Motion transfer uploads)
6. Settings pills (render slot — duration, aspect ratio, resolution popups)
7. Generate button with credit cost

The actual implementation will involve moving the JSX from generate-client.tsx into this component. Since the JSX is ~600 lines of existing code, the extraction is mechanical — move the elements, pass state as props. The parent keeps all `useState` hooks and passes values + setters down.

- [ ] **Step 2: Commit**

```
git add src/components/generate/settings-content.tsx
git commit -m "feat: extract StudioSettingsContent from generate-client"
```

---

## Task 6: Rewrite generate-client.tsx Layout

The main integration task. Replace the three-panel layout with:
- **Desktop**: Two-panel (320px settings left + flex-1 output with inline details cards)
- **Mobile**: Full-screen output + bottom button + settings sheet

**Files:**
- Modify: `src/app/(app)/generate/generate-client.tsx`

- [ ] **Step 1: Add imports and isMobile hook**

At the top of generate-client.tsx, add:

```tsx
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SettingsSheet } from "@/components/generate/settings-sheet";
import { BottomButton } from "@/components/generate/bottom-button";
import { GenerationDetailsCard } from "@/components/generate/generation-details-card";
```

Inside the component function, add:

```tsx
const isMobile = useIsMobile();
const [sheetOpen, setSheetOpen] = useState(false);
```

- [ ] **Step 2: Replace the three-panel layout**

The current layout is:

```tsx
<div className="... flex ...">
  {/* Left panel — 320px settings */}
  <div className="w-[320px] ...">...</div>
  {/* Center panel — flex-1 output */}
  <div className="flex-1 ...">...</div>
  {/* Right panel — 300px details */}
  <div className="w-[300px] ...">...</div>
</div>
```

Replace with:

```tsx
<div className="... flex ...">
  {/* Desktop settings sidebar — hidden on mobile */}
  {!isMobile && (
    <div className="w-[320px] ...">
      {/* All settings content stays here for desktop */}
    </div>
  )}

  {/* Output area — full width on mobile, flex-1 on desktop */}
  <div className="flex-1 overflow-y-auto">
    {/* Empty state or generation list */}
    {generations.length === 0 ? (
      <div className="flex h-full items-center justify-center">
        {/* Empty state placeholder */}
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {isMobile
              ? "Tap New Generation to start"
              : "Configure your settings and click Generate"}
          </p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {/* Each generation: video/image + details card */}
        {generations.map((gen) => (
          <div key={gen.id}>
            {/* Video/image player */}
            {gen.status === "completed" && gen.outputUrl && (
              <video
                src={gen.outputUrl}
                controls
                autoPlay
                muted
                playsInline
                className="w-full rounded-[var(--radius-lg)]"
              />
            )}
            {/* In-progress state */}
            {(gen.status === "queued" || gen.status === "processing" || gen.status === "submitting") && (
              <div className="flex aspect-video items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                  <p className="text-sm text-[var(--text-muted)]">Generating...</p>
                </div>
              </div>
            )}
            {/* Details card */}
            <GenerationDetailsCard
              prompt={gen.prompt}
              modelName={gen.modelName}
              durationSec={gen.durationSec}
              withAudio={gen.withAudio}
              creditCost={gen.creditCost}
              status={gen.status}
              errorMessage={gen.errorMessage}
              createdAt={gen.createdAt}
              generationTimeMs={gen.generationTimeMs}
              outputUrl={gen.outputUrl}
              onDownload={() => { /* existing download logic */ }}
              onRegenerate={() => { /* existing regenerate logic */ }}
            />
          </div>
        ))}
      </div>
    )}
  </div>

  {/* RIGHT PANEL REMOVED — replaced by GenerationDetailsCard above */}
</div>

{/* Mobile: bottom button + settings sheet */}
{isMobile && (
  <>
    <BottomButton
      isGenerating={isAnyGenerating}
      onClick={() => setSheetOpen(true)}
    />
    <SettingsSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
      {/* Same settings content as desktop sidebar */}
    </SettingsSheet>
  </>
)}
```

- [ ] **Step 3: Wire up generate to close sheet**

In the handleGenerate function, add `setSheetOpen(false)` at the start:

```tsx
const handleGenerate = async () => {
  if (isMobile) setSheetOpen(false);
  // ... existing generation logic
};
```

- [ ] **Step 4: Commit**

```
git add src/app/(app)/generate/generate-client.tsx
git commit -m "feat: two-panel desktop + mobile bottom sheet layout for /generate"
```

---

## Task 7: Studio Mobile Layout

On mobile, remove QuickCreateBar and switch the horizontal carousels to vertical grid albums.

**Files:**
- Modify: `src/app/(app)/studio/page.tsx`
- Modify: `src/components/studio/character-reel.tsx`
- Modify: `src/components/studio/recent-generations.tsx`

- [ ] **Step 1: Update studio page**

In `src/app/(app)/studio/page.tsx`, hide QuickCreateBar on mobile:

```tsx
return (
  <div className="flex flex-col gap-6 md:gap-12">
    <div className="hidden md:block">
      <QuickCreateBar />
    </div>
    {characters.length > 0 && <CharacterReel characters={characterCards} />}
    {generationCards.length > 0 && <RecentGenerations generations={generationCards} />}
  </div>
);
```

- [ ] **Step 2: Add grid mode to CharacterReel**

In `src/components/studio/character-reel.tsx`, wrap the horizontal scroll in a `hidden md:flex` and add a mobile grid below it:

```tsx
// Add to the component's return JSX:

{/* Mobile grid */}
<div className="grid grid-cols-2 gap-3 md:hidden">
  {/* "New Character" card */}
  <Link
    href="/characters/new"
    className="flex aspect-[3/4] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--accent-amber)]"
  >
    <div className="text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/50">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent-amber)]">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span className="text-xs text-[var(--text-muted)]">New Character</span>
    </div>
  </Link>
  {/* Character cards */}
  {characters.map((c) => (
    <Link key={c.id} href={`/characters/${c.id}`} className="aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      {c.thumbnailUrl ? (
        <img src={c.thumbnailUrl} alt={c.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">{c.name}</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="truncate text-xs font-medium text-white/90">{c.name}</p>
      </div>
    </Link>
  ))}
</div>

{/* Desktop horizontal scroll — hide on mobile */}
<div className="hidden md:flex ...">
  {/* existing horizontal scroll content */}
</div>
```

- [ ] **Step 3: Add grid mode to RecentGenerations**

Same pattern — `md:hidden` grid + `hidden md:flex` horizontal scroll:

```tsx
{/* Mobile grid */}
<div className="grid grid-cols-2 gap-3 md:hidden">
  {/* "New Generation" card */}
  <Link
    href="/generate"
    className="flex aspect-[3/2] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]"
  >
    <div className="text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/50">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent-amber)]">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span className="text-xs text-[var(--text-muted)]">New Generation</span>
    </div>
  </Link>
  {/* Generation cards */}
  {generations.map((g) => (
    <Link key={g.id} href="/generate" className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      {g.videoUrl ? (
        <video src={g.videoUrl} muted playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
          {g.status === "COMPLETED" ? "No preview" : g.status}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="truncate text-[10px] text-white/70">{g.modelId}</p>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 4: Commit**

```
git add src/app/(app)/studio/page.tsx src/components/studio/character-reel.tsx src/components/studio/recent-generations.tsx
git commit -m "feat: studio mobile layout — grid albums, hide quick generate"
```

---

## Task 8: Landing Page Mobile Fixes

Fix the missing nav bar and video playback on mobile.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add mobile nav bar**

The current nav is `hidden md:flex`. Add a mobile-specific nav at the top:

```tsx
{/* ─── Mobile nav ─── */}
<nav className="flex items-center justify-between px-5 pt-4 pb-2 md:hidden">
  <Link href="/" className="font-display text-base font-bold tracking-tight text-[var(--accent-amber)]">
    Artifacial
  </Link>
  <div className="flex items-center gap-3">
    <Link
      href="/pricing"
      className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    >
      Pricing
    </Link>
    <Link
      href="/sign-in"
      className="rounded-full bg-[var(--accent-amber)] px-4 py-1.5 text-sm font-semibold text-[var(--bg-deep)]"
    >
      Sign In
    </Link>
  </div>
</nav>
```

Add this directly below the opening `<div>` and before the existing desktop `<nav>`. Also remove the standalone mobile logo (`md:hidden` span at line ~162) since the mobile nav now shows the logo.

- [ ] **Step 2: Fix video playback**

The capability card videos already have `autoPlay loop muted playsInline` which should work on mobile. If they're not playing, the issue is likely that the video files are too large for mobile bandwidth. Add `preload="metadata"` to defer loading and ensure `playsInline` is lowercase (JSX requires camelCase `playsInline` which is correct):

```tsx
<video
  autoPlay
  loop
  muted
  playsInline
  preload="metadata"
  className="absolute inset-0 h-full w-full object-cover"
  src={cap.video}
/>
```

If videos still don't auto-play on iOS, the fallback is to use an Intersection Observer to trigger `.play()` when visible. Add this as a client component wrapper if needed after testing.

- [ ] **Step 3: Commit**

```
git add src/app/page.tsx
git commit -m "feat: add mobile nav to landing page, improve video playback"
```

---

## Task 9: TypeScript Verification & Final Polish

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Fix any type errors.

- [ ] **Step 2: Visual testing**

Test in browser at 375px viewport width:
1. Landing page — nav visible, videos play, CTA buttons full-width
2. /studio — grid albums, no quick generate bar, bottom nav visible
3. /generate — bottom button visible, sheet opens/closes, drag-to-dismiss works, generate flow works
4. Other pages (/characters, /gallery, /settings) — sidebar hidden, bottom nav visible, content fills width

- [ ] **Step 3: Commit any fixes**

```
git add -A
git commit -m "fix: mobile layout polish and type fixes"
```

---

## Execution Order

Tasks 1-4 can be parallelized (hook, nav, details card, sheet are independent). Task 5 depends on understanding the full generate-client.tsx structure. Task 6 is the critical integration that depends on all prior tasks. Tasks 7-8 are independent of each other and of Task 6.

```
Task 1 (hook) ──────────┐
Task 2 (mobile nav) ────┤
Task 3 (details card) ──┼── Task 5 (extract settings) ── Task 6 (rewrite generate layout)
Task 4 (sheet + button) ┘
Task 7 (studio mobile) ────── independent
Task 8 (landing mobile) ────── independent
Task 9 (verify) ────── after all
```
