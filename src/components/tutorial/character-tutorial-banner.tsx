"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TUTORIAL_PHASE_KEY, TUTORIAL_DONE_KEY } from "@/components/tutorial-overlay";

export function CharacterTutorialBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const phase = localStorage.getItem(TUTORIAL_PHASE_KEY);
    if (phase === "characters-create") setVisible(true);
  }, []);

  const handleDone = () => {
    // Skip generate-tour, go straight to the video generation tutorial
    localStorage.setItem(TUTORIAL_PHASE_KEY, "generate-video");
    router.push("/generate");
  };

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
    localStorage.removeItem(TUTORIAL_PHASE_KEY);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/5 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber)] text-[11px] font-bold text-[var(--bg-deep)]">
          1
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Create your first character
        </p>
        <span className="ml-auto rounded-full bg-[var(--accent-amber)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-amber)]">
          Step 1 of 2
        </span>
      </div>

      {/* Model guide */}
      <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
        Upload a photo or describe a person below. Here&apos;s which model to pick:
      </p>
      <div className="mb-4 space-y-2">
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5 px-3 py-2.5">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-amber)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Nano Banana 2 — 150 cr <span className="font-normal text-[var(--accent-amber)]">(Recommended)</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Google&apos;s image editing model. Best realism, preserves likeness, photographic quality.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2.5">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--border-default)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Flux Dev / Seedream 5 — 90 cr</p>
            <p className="text-[11px] text-[var(--text-muted)]">Good quality, faster. Use if you want to iterate quickly.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2.5">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--border-default)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Flux Schnell / Z-Image Turbo — 10–40 cr</p>
            <p className="text-[11px] text-[var(--text-muted)]">Budget option. Fast drafts, lower fidelity.</p>
          </div>
        </div>
      </div>

      <p className="mb-4 text-xs text-[var(--text-muted)]">
        Generate your character image, then save it with a name. When you&apos;re happy with it, click below to move to Step 2 — generating your first video with Kling 2.6 Standard.
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={handleSkip}
          className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          Skip tutorial
        </button>
        <button
          onClick={handleDone}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] transition-opacity hover:opacity-90"
        >
          I&apos;ve saved my character →
        </button>
      </div>
    </div>
  );
}
