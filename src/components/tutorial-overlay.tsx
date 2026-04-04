"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export const TUTORIAL_PHASE_KEY = "artifacial_tutorial_phase";
export const TUTORIAL_DONE_KEY = "artifacial_tutorial_done";

export type TutorialPhase = "generate-tour" | "generate-video";

interface TutorialOverlayProps {
  phase: TutorialPhase;
  onDone: () => void;
}

interface Step {
  target: string | null;
  title: string;
  body: string;
  position?: "below" | "above" | "right";
  // If set, the Next button text and action are overridden
  ctaLabel?: string;
  ctaAction?: () => void;
}

// ─── Step definitions per phase ───

function buildGenerateTourSteps(onStartVideo: () => void): Step[] {
  return [
    {
      target: null,
      title: "Now let's make your first video",
      body: "Great — your character is ready! This is the Generate page, where all your AI videos are created. Let's take 30 seconds to learn the layout.",
    },
    {
      target: "[data-tutorial='mode-tabs']",
      title: "Choose your creation mode",
      body: "Text→Video creates from a prompt alone. Image→Video animates a photo. Motion Transfer overlays movement from a reference video onto your character.",
      position: "below",
    },
    {
      target: "[data-tutorial='model-picker']",
      title: "Pick your AI model",
      body: "Budget models are fast and cheap. Standard is the sweet spot. Ultra gives cinematic quality. We'll use Kling 2.6 Standard (850 cr) for your first video.",
      position: "below",
    },
    {
      target: "[data-tutorial='prompt-area']",
      title: "Describe your scene",
      body: "Write a detailed description — setting, lighting, camera movement, mood. The more specific you are, the better your video will look.",
      position: "above",
    },
    {
      target: null,
      title: "Ready to generate",
      body: "Switch to Image→Video, select your character, pick Kling 2.6 Standard, write your prompt, and hit Generate. Your first video will appear in the center panel.",
      ctaLabel: "Let's do it →",
      ctaAction: onStartVideo,
    },
  ];
}

function buildGenerateVideoSteps(): Step[] {
  return [
    {
      target: null,
      title: "Your character is ready!",
      body: "Now let's generate your first video using it. We'll use Image→Video mode with Kling 2.6 Standard — 850 credits for a 5-second clip.",
    },
    {
      target: "[data-tutorial='mode-tabs']",
      title: "Switch to Image → Video",
      body: "Click \"Image → Video\" in the mode tabs. This lets you select your character image as the starting frame for your video.",
      position: "below",
    },
    {
      target: "[data-tutorial='model-picker']",
      title: "Select Kling 2.6 Standard",
      body: "Open the model dropdown and choose Kling 2.6 Standard. It costs 850 credits for 5 seconds — reliable quality, great for your first generation.",
      position: "below",
    },
    {
      target: "[data-tutorial='prompt-area']",
      title: "Describe the scene",
      body: "Write what you want happening around your character — the setting, camera movement, and mood. Your character will be the subject.",
      position: "above",
    },
    {
      target: "[data-tutorial='generate-btn']",
      title: "Generate your first video",
      body: "Hit Generate. Your video will appear in the center panel while it processes. You've got this — enjoy your first Artifacial creation!",
      position: "above",
    },
  ];
}

// ─── Spotlight helpers ───

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function clampToViewport(
  top: number | undefined,
  left: number | undefined,
  bottom: number | undefined,
  cardWidth: number,
  cardHeight: number
): { top?: number; left: number; bottom?: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const padding = 12;

  let resolvedLeft = left ?? 0;
  let resolvedTop = top;
  let resolvedBottom = bottom;

  if (resolvedLeft + cardWidth > vw - padding) resolvedLeft = vw - cardWidth - padding;
  if (resolvedLeft < padding) resolvedLeft = padding;

  if (resolvedTop !== undefined) {
    if (resolvedTop + cardHeight > vh - padding) resolvedTop = vh - cardHeight - padding;
    if (resolvedTop < padding) resolvedTop = padding;
  }
  if (resolvedBottom !== undefined) {
    if (resolvedBottom + cardHeight > vh - padding) resolvedBottom = vh - cardHeight - padding;
    if (resolvedBottom < padding) resolvedBottom = padding;
  }

  return { top: resolvedTop, left: resolvedLeft, bottom: resolvedBottom };
}

// ─── Component ───

export function TutorialOverlay({ phase, onDone }: TutorialOverlayProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [cardKey, setCardKey] = useState(0);

  const startVideo = useCallback(() => {
    localStorage.setItem(TUTORIAL_PHASE_KEY, "generate-video");
    // Stay on /generate but switch phase — reload the tutorial
    window.location.reload();
  }, []);

  const steps: Step[] =
    phase === "generate-tour"
      ? buildGenerateTourSteps(startVideo)
      : buildGenerateVideoSteps();

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const CARD_WIDTH = 300;
  const CARD_HEIGHT = 200;

  const updateSpotlight = useCallback(() => {
    if (!step?.target) { setSpotlightRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setSpotlightRect(null); return; }
    const rect = el.getBoundingClientRect();
    setSpotlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [step?.target]);

  useEffect(() => {
    const done = localStorage.getItem(TUTORIAL_DONE_KEY);
    const savedPhase = localStorage.getItem(TUTORIAL_PHASE_KEY);
    if (done === "1" || savedPhase !== phase) { return; }
    setVisible(true);
  }, [phase]);

  useEffect(() => {
    if (!visible) return;
    updateSpotlight();
    setCardKey((k) => k + 1);
  }, [visible, stepIndex, updateSpotlight]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [visible, updateSpotlight]);

  const markDone = useCallback(() => {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
    localStorage.removeItem(TUTORIAL_PHASE_KEY);
    setVisible(false);
    onDone();
  }, [onDone]);

  const handleNext = () => {
    if (step.ctaAction) {
      step.ctaAction();
      return;
    }
    if (isLast) {
      markDone();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  if (!visible || !step) return null;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {};

  if (!spotlightRect) {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 9999,
      width: CARD_WIDTH,
    };
  } else {
    const pad = 8;
    const sr = spotlightRect;
    let rawTop: number | undefined;
    let rawLeft: number | undefined;
    let rawBottom: number | undefined;

    switch (step.position) {
      case "below":
        rawTop = sr.top + sr.height + pad * 2 + 16;
        rawLeft = sr.left;
        break;
      case "above":
        rawBottom = (typeof window !== "undefined" ? window.innerHeight : 800) - (sr.top - pad * 2 - 16);
        rawLeft = sr.left;
        break;
      case "right":
        rawTop = sr.top;
        rawLeft = sr.left + sr.width + pad * 2 + 16;
        break;
      default:
        rawTop = sr.top + sr.height + pad * 2 + 16;
        rawLeft = sr.left;
    }

    const clamped = clampToViewport(rawTop, rawLeft, rawBottom, CARD_WIDTH, CARD_HEIGHT);
    tooltipStyle = {
      position: "fixed",
      zIndex: 9999,
      width: CARD_WIDTH,
      ...(clamped.top !== undefined ? { top: clamped.top } : {}),
      ...(clamped.bottom !== undefined ? { bottom: clamped.bottom } : {}),
      left: clamped.left,
    };
  }

  const totalSteps = steps.length;

  return (
    <>
      {/* Backdrop / spotlight */}
      {spotlightRect ? (
        <div
          style={{
            position: "fixed",
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        key={cardKey}
        style={tooltipStyle}
        className="animate-fade-in-up rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      >
        {/* Progress dots */}
        <div className="mb-3 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? "w-4 bg-[var(--accent-amber)]"
                  : i < stepIndex
                  ? "w-2 bg-[var(--accent-amber)]/40"
                  : "w-2 bg-[var(--border-default)]"
              }`}
            />
          ))}
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>

        <h3 className="font-display text-[15px] font-bold leading-snug text-[var(--text-primary)]">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {step.body}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={handleNext}
            className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-deep)] transition-opacity hover:opacity-90"
          >
            {step.ctaLabel ?? (isLast ? "Done ✓" : "Next →")}
          </button>
          <button
            onClick={markDone}
            className="w-full py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </>
  );
}
