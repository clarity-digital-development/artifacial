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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Step indicator */}
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber)] text-[11px] font-bold text-[var(--bg-deep)]">
            2
          </div>
          <div>
            <div className="mb-0.5 flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Create your first character
              </p>
              <span className="rounded-full bg-[var(--accent-amber)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-amber)]">
                Step 2 of 3
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Upload a photo or describe a person in the prompt. For photorealistic results, select{" "}
              <span className="font-medium text-[var(--text-secondary)]">Nano Banana 2</span> — it costs{" "}
              <span className="font-medium text-[var(--text-secondary)]">150 credits</span> and produces
              the most realistic faces. Generate your character, then click the button below when you&apos;re happy with it.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
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
          I&apos;ve created my character →
        </button>
      </div>
    </div>
  );
}
