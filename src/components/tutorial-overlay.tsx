"use client";

import { useEffect, useState, useCallback } from "react";

interface TutorialOverlayProps {
  active: boolean;
  onDone: () => void;
}

interface Step {
  target: string | null;
  title: string;
  body: string;
  position?: "below" | "above" | "right";
}

const STEPS: Step[] = [
  {
    target: null,
    title: "Welcome to Artifacial",
    body: "Let's take a quick tour so you know how to create your first AI video. It only takes a minute.",
  },
  {
    target: "[data-tutorial='mode-tabs']",
    title: "Choose your mode",
    body: "Text-to-Video generates from a prompt. Image-to-Video animates a photo. Motion Transfer overlays motion from one video onto your character.",
    position: "below",
  },
  {
    target: "[data-tutorial='model-picker']",
    title: "Pick a model",
    body: "Each model has different strengths. Budget models are fast and cheap. Ultra models produce cinematic quality. Start with Kling 3.0 for the best results.",
    position: "right",
  },
  {
    target: "[data-tutorial='prompt-area']",
    title: "Describe your video",
    body: "Type a detailed description of what you want to see. Include the scene, lighting, camera movement, and mood. More detail = better results.",
    position: "above",
  },
  {
    target: "[data-tutorial='generate-btn']",
    title: "Generate your video",
    body: "Hit Generate when you're ready. Your video will appear in the center panel. You can queue multiple generations at once.",
    position: "above",
  },
];

const STORAGE_KEY = "artifacial_tutorial_done";

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

  // Clamp left so card doesn't go off right edge
  if (resolvedLeft + cardWidth > vw - padding) {
    resolvedLeft = vw - cardWidth - padding;
  }
  if (resolvedLeft < padding) {
    resolvedLeft = padding;
  }

  // Clamp top so card doesn't go off bottom edge
  if (resolvedTop !== undefined) {
    if (resolvedTop + cardHeight > vh - padding) {
      resolvedTop = vh - cardHeight - padding;
    }
    if (resolvedTop < padding) {
      resolvedTop = padding;
    }
  }

  // Clamp bottom so card doesn't go off top edge
  if (resolvedBottom !== undefined) {
    if (resolvedBottom + cardHeight > vh - padding) {
      resolvedBottom = vh - cardHeight - padding;
    }
    if (resolvedBottom < padding) {
      resolvedBottom = padding;
    }
  }

  return { top: resolvedTop, left: resolvedLeft, bottom: resolvedBottom };
}

export function TutorialOverlay({ active, onDone }: TutorialOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  // cardKey is used to re-trigger the fade-in animation on step change
  const [cardKey, setCardKey] = useState(0);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const CARD_WIDTH = 288; // w-72 = 18rem = 288px
  const CARD_HEIGHT = 180; // approximate

  const updateSpotlight = useCallback(() => {
    if (!step.target) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setSpotlightRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [step.target]);

  // Check localStorage on mount
  useEffect(() => {
    if (!active) return;
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (done === "1") {
        onDone();
        return;
      }
    } catch {
      // localStorage unavailable — proceed with tutorial
    }
    setVisible(true);
  }, [active, onDone]);

  // Update spotlight when step changes
  useEffect(() => {
    if (!visible) return;
    updateSpotlight();
    setCardKey((k) => k + 1);
  }, [visible, stepIndex, updateSpotlight]);

  // Update spotlight on resize
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [visible, updateSpotlight]);

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    onDone();
  }, [onDone]);

  const handleNext = () => {
    if (isLast) {
      markDone();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    markDone();
  };

  if (!visible) return null;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {};

  if (!spotlightRect) {
    // Welcome step or target not found — center of screen
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

  return (
    <>
      {/* Backdrop */}
      {spotlightRect ? (
        // Spotlight cutout via boxShadow
        <div
          style={{
            position: "fixed",
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      ) : (
        // Solid backdrop for welcome step
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.72)",
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        key={cardKey}
        style={tooltipStyle}
        className="animate-fade-in-up bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] w-72"
      >
        {/* Step counter */}
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">
          Step {stepIndex + 1} of {STEPS.length}
        </p>

        {/* Title */}
        <h3 className="font-display text-lg font-bold text-[var(--text-primary)] leading-snug">
          {step.title}
        </h3>

        {/* Body */}
        <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
          {step.body}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleSkip}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="bg-[var(--accent-amber)] text-[var(--bg-deep)] text-sm font-semibold px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
          >
            {isLast ? "Done" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}
