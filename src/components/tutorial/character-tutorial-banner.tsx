"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TUTORIAL_PHASE_KEY, TUTORIAL_DONE_KEY } from "@/components/tutorial-overlay";

interface CharacterTutorialBannerProps {
  generationComplete?: boolean;
}

export function CharacterTutorialBanner({ generationComplete = false }: CharacterTutorialBannerProps) {
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

  const steps = [
    {
      num: 1,
      title: "Put your prompt in first",
      body: "Describe your character in the prompt box below.",
    },
    {
      num: 2,
      title: "Pick your image type",
      body: "Choose a style — e.g. Photorealistic, Cinematic, Anime.",
    },
    {
      num: 3,
      title: "Pick your aspect ratio",
      body: "Portrait (2:3 or 9:16), square (1:1), or landscape.",
    },
    {
      num: 4,
      title: (
        <>
          Pick your model — use <span className="font-bold text-[var(--text-primary)]">Nano Banana 2</span> for best quality
        </>
      ),
      body: (
        <span className="text-[var(--text-muted)]">
          Or try <span className="text-[var(--text-secondary)]">Sea Dance</span> for a faster, cheaper generation.
        </span>
      ),
    },
  ];

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border-l-2 border-[var(--accent-amber)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
          Tutorial — Step 1 of 2
        </p>
        <button
          onClick={handleSkip}
          className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          Skip tutorial
        </button>
      </div>

      {/* Steps */}
      <ol className="mb-3 space-y-2">
        {steps.map((step) => (
          <li key={step.num} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber)] text-[9px] font-bold text-[var(--bg-deep)]">
              {step.num}
            </div>
            <div>
              <p className="text-xs font-medium leading-snug text-[var(--text-secondary)]">
                {step.title}
              </p>
              {step.body && (
                <p className="mt-0.5 text-[11px] leading-relaxed">{step.body}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Post-generation callout */}
      {generationComplete && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/8 px-3 py-2">
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-amber)] text-[9px] font-bold text-[var(--bg-deep)]"
            style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
          >
            ✓
          </span>
          <p className="text-xs font-medium text-[var(--accent-amber)]">
            Great! Now save your character below.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleDone}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-xs font-semibold text-[var(--bg-deep)] transition-opacity hover:opacity-90"
        >
          I&apos;ve saved my character →
        </button>
      </div>
    </div>
  );
}
