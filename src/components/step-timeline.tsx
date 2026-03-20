"use client";

import { useEffect, useRef, useState } from "react";

// ─── Step data ───

const STEPS = [
  {
    title: "Create your character",
    desc: "One photo builds your persistent AI identity.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    title: "Write your scene",
    desc: "Describe what happens — the AI handles the rest.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="17" y1="10" x2="3" y2="10" />
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="17" y1="18" x2="3" y2="18" />
      </svg>
    ),
  },
  {
    title: "Generate in seconds",
    desc: "Cinematic video, ready to post.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
  },
];

const TIMING = {
  circle: [0, 1200, 2400],
  connector: [600, 1800],
  duration: 800,
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
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="mx-auto hidden max-w-3xl md:block">
      {/* Three equal columns — circles centered, connectors bridging the gaps */}
      <div className="relative flex text-center">
        {STEPS.map((step, i) => (
          <div key={i} className="flex flex-1 flex-col items-center">
            {/* Circle */}
            <div className="relative z-10">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[2.5px] border-[#2A2A32] bg-[var(--bg-deep)]">
                <div
                  style={{
                    color: on ? "#E8A634" : "#56525A",
                    transition: `color ${TIMING.duration}ms ease-out ${TIMING.circle[i]}ms`,
                  }}
                >
                  {step.icon}
                </div>
              </div>

              {/* Amber overlay ring */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  boxShadow: on
                    ? "0 0 20px 2px rgba(232, 166, 52, 0.25), inset 0 0 12px rgba(232, 166, 52, 0.08)"
                    : "0 0 0 0 rgba(232, 166, 52, 0)",
                  border: "2.5px solid",
                  borderColor: on ? "#E8A634" : "transparent",
                  opacity: on ? 1 : 0,
                  transition: `all ${TIMING.duration}ms ease-out ${TIMING.circle[i]}ms`,
                }}
              />
            </div>

            {/* Label */}
            <div className="mt-5 px-2">
              <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {step.desc}
              </p>
            </div>
          </div>
        ))}

        {/* Connectors — absolutely positioned to bridge circle edges */}
        {TIMING.connector.map((delay, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              /* Each column is 33.33% wide. Circle (72px) is centered in column.
                 Left connector: from center of col 0 + 36px to center of col 1 - 36px
                 Right connector: from center of col 1 + 36px to center of col 2 - 36px
                 Column centers are at 16.67%, 50%, 83.33% */
              left: `calc(${16.667 + i * 33.333}% + 36px)`,
              right: `calc(${83.333 - (i + 1) * 33.333}% + 36px)`,
              top: 35, /* vertically center on 72px circles */
              height: "2.5px",
            }}
          >
            {/* Gray base */}
            <div className="absolute inset-0 bg-[#2A2A32]" />

            {/* Amber sweep */}
            <div
              className="absolute inset-0 origin-left"
              style={{
                background: "linear-gradient(to right, #E8A634, #D4603A)",
                transform: on ? "scaleX(1)" : "scaleX(0)",
                transition: `transform ${TIMING.duration}ms ease-out ${delay}ms`,
              }}
            />

            {/* Glow */}
            <div
              className="absolute -inset-y-1 inset-x-0 origin-left"
              style={{
                background: "linear-gradient(to right, rgba(232,166,52,0.3), rgba(212,96,58,0.15))",
                filter: "blur(6px)",
                transform: on ? "scaleX(1)" : "scaleX(0)",
                transition: `transform ${TIMING.duration}ms ease-out ${delay}ms`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
