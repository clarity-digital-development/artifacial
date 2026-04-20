"use client";

import { useEffect, useRef, useState } from "react";

// ─── Step data ───

const STEPS = [
  {
    n: "01",
    title: "Build your cast",
    body: "Upload one clear selfie. We train a persistent AI character — same face, same look, every scene you create.",
  },
  {
    n: "02",
    title: "Direct the scene",
    body: "Write what you want to see. Pick a model for the vibe — cinematic, stylized, fast, or premium. We handle the rest.",
  },
  {
    n: "03",
    title: "Render and ship",
    body: "Cinematic video in under 2 minutes. Ready for TikTok, Reels, YouTube, or wherever you post.",
  },
];

// Sequence timing
const T = {
  nodeDelays: [0, 900, 1800] as const,
  connectorDelays: [450, 1350] as const,
  duration: 700,
};

// ─── Component ───

export function StepTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative mt-10 md:mt-16">
      {/* ─────────────── Desktop: horizontal row ─────────────── */}
      <div className="hidden md:block">
        {/* Node rail */}
        <div className="relative h-6">
          {/* Base line (gray) */}
          <div
            className="absolute left-[calc(16.667%+12px)] right-[calc(16.667%+12px)] top-1/2 h-[2px] -translate-y-1/2 bg-[var(--border-default)]"
            aria-hidden
          />

          {/* Amber sweep segments */}
          {T.connectorDelays.map((delay, i) => (
            <ConnectorSegment
              key={i}
              lit={on}
              delay={delay}
              duration={T.duration}
              axis="horizontal"
              style={{
                left: `calc(${16.667 + i * 33.333}% + 12px)`,
                right: `calc(${83.333 - (i + 1) * 33.333}% + 12px)`,
                top: "50%",
                height: "2px",
                transform: "translateY(-50%)",
              }}
            />
          ))}

          {/* Nodes — positioned at column centers */}
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${16.667 + i * 33.333}%` }}
            >
              <Node lit={on} delay={T.nodeDelays[i]} duration={T.duration} />
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.n}
              step={step}
              lit={on}
              delay={T.nodeDelays[i]}
              duration={T.duration}
            />
          ))}
        </div>
      </div>

      {/* ─────────────── Mobile: vertical stack ─────────────── */}
      <MobileTimeline on={on} />
    </div>
  );
}

// ─── Mobile timeline with JS-measured line ───

function MobileTimeline({ on }: { on: boolean }) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lineMetrics, setLineMetrics] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    function measure() {
      const first = rowRefs.current[0];
      const last = rowRefs.current[STEPS.length - 1];
      if (!first || !last) return;
      const firstCenter = first.offsetTop + first.offsetHeight / 2;
      const lastCenter = last.offsetTop + last.offsetHeight / 2;
      setLineMetrics({ top: firstCenter, height: lastCenter - firstCenter });
    }
    measure();
    // Re-measure on resize and after fonts/images load
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 300);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="relative md:hidden">
      {/* Base gray line — from first card center to last card center */}
      {lineMetrics && (
        <div
          aria-hidden
          className="absolute w-[2px] bg-[var(--border-default)]"
          style={{
            left: "11px",
            top: `${lineMetrics.top}px`,
            height: `${lineMetrics.height}px`,
          }}
        />
      )}

      {/* Amber sweep overlay */}
      {lineMetrics && (
        <ConnectorSegment
          lit={on}
          delay={T.connectorDelays[0]}
          duration={T.duration * 2}
          axis="vertical"
          style={{
            left: "11px",
            top: `${lineMetrics.top}px`,
            height: `${lineMetrics.height}px`,
            width: "2px",
          }}
        />
      )}

      {/* Rows */}
      <div className="flex flex-col gap-5">
        {STEPS.map((step, i) => (
          <div
            key={step.n}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className="relative flex items-center gap-4"
          >
            {/* Node centered vertically with card */}
            <div className="relative z-10 flex-shrink-0">
              <Node lit={on} delay={T.nodeDelays[i]} duration={T.duration} />
            </div>
            {/* Card */}
            <div className="flex-1 min-w-0">
              <StepCard
                step={step}
                lit={on}
                delay={T.nodeDelays[i]}
                duration={T.duration}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Node ───

function Node({
  lit,
  delay,
  duration,
}: {
  lit: boolean;
  delay: number;
  duration: number;
}) {
  return (
    <div className="relative h-6 w-6">
      {/* Outer gray ring (base state) */}
      <div className="absolute inset-0 rounded-full border-2 border-[var(--border-default)] bg-[var(--bg-deep)]" />
      {/* Amber ring overlay */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: "2px solid #E8A634",
          boxShadow: lit
            ? "0 0 18px 3px rgba(232, 166, 52, 0.40), inset 0 0 6px rgba(232, 166, 52, 0.25)"
            : "0 0 0 0 rgba(232, 166, 52, 0)",
          opacity: lit ? 1 : 0,
          transition: `opacity ${duration}ms ease-out ${delay}ms, box-shadow ${duration}ms ease-out ${delay}ms`,
        }}
      />
      {/* Inner amber dot */}
      <div
        className="absolute left-1/2 top-1/2 h-[8px] w-[8px] rounded-full bg-[var(--accent-amber)]"
        style={{
          transform: `translate(-50%, -50%) scale(${lit ? 1 : 0})`,
          opacity: lit ? 1 : 0,
          transition: `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity ${duration}ms ease-out ${delay}ms`,
        }}
      />
    </div>
  );
}

// ─── Connector segment (amber sweep + glow) ───

function ConnectorSegment({
  lit,
  delay,
  duration,
  axis,
  style,
}: {
  lit: boolean;
  delay: number;
  duration: number;
  axis: "horizontal" | "vertical";
  style: React.CSSProperties;
}) {
  const scale = axis === "vertical" ? "scaleY" : "scaleX";
  const origin = axis === "vertical" ? "top" : "left";
  return (
    <div className="absolute pointer-events-none" style={style} aria-hidden>
      {/* Solid amber gradient fill */}
      <div
        className="absolute inset-0"
        style={{
          background:
            axis === "vertical"
              ? "linear-gradient(to bottom, #E8A634, #D4603A)"
              : "linear-gradient(to right, #E8A634, #D4603A)",
          transformOrigin: origin,
          transform: lit ? `${scale}(1)` : `${scale}(0)`,
          transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        }}
      />
      {/* Glow */}
      <div
        className="absolute"
        style={{
          ...(axis === "vertical"
            ? { top: 0, bottom: 0, left: "-4px", right: "-4px" }
            : { left: 0, right: 0, top: "-4px", bottom: "-4px" }),
          background:
            axis === "vertical"
              ? "linear-gradient(to bottom, rgba(232,166,52,0.35), rgba(212,96,58,0.12))"
              : "linear-gradient(to right, rgba(232,166,52,0.35), rgba(212,96,58,0.12))",
          filter: "blur(6px)",
          transformOrigin: origin,
          transform: lit ? `${scale}(1)` : `${scale}(0)`,
          transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        }}
      />
    </div>
  );
}

// ─── Step card ───

function StepCard({
  step,
  lit,
  delay,
  duration,
}: {
  step: { n: string; title: string; body: string };
  lit: boolean;
  delay: number;
  duration: number;
}) {
  const litDelay = delay + 250;
  return (
    <div
      className="group relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-surface)]/40 p-6 backdrop-blur-sm md:p-8"
      style={{
        border: "1px solid",
        borderColor: lit ? "rgba(232, 166, 52, 0.28)" : "var(--border-subtle)",
        transition: `border-color ${duration}ms ease-out ${litDelay}ms`,
      }}
    >
      {/* Oversized step number */}
      <div
        className="font-display text-[56px] leading-none md:text-[72px]"
        style={{
          color: lit ? "rgba(232, 166, 52, 0.50)" : "rgba(232, 166, 52, 0.15)",
          transition: `color ${duration}ms ease-out ${litDelay}ms`,
        }}
      >
        {step.n}
      </div>

      <h3 className="mt-4 font-display text-xl text-[var(--text-primary)] md:text-2xl">
        {step.title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
        {step.body}
      </p>

      {/* Corner amber wash — appears on ignition, amplifies on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--accent-amber)] blur-3xl transition-opacity duration-700 group-hover:opacity-[0.12]"
        style={{
          opacity: lit ? 0.06 : 0,
          transitionDelay: `${litDelay + 100}ms`,
        }}
      />
    </div>
  );
}
