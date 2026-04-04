"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PHASE_KEY = "artifacial_tutorial_phase";
const DONE_KEY = "artifacial_tutorial_done";

export function StudioOnboarding() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(DONE_KEY);
    const phase = localStorage.getItem(PHASE_KEY);
    // Show the modal only if they've never answered the tutorial prompt
    if (!done && !phase) {
      setShowModal(true);
    }
  }, []);

  const handleYes = () => {
    localStorage.setItem(PHASE_KEY, "generate-tour");
    router.push("/generate");
  };

  const handleNo = () => {
    localStorage.setItem(DONE_KEY, "1");
    setShowModal(false);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16">
      {/* Tutorial modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="animate-fade-in-up relative w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 shadow-2xl">
            {/* Icon */}
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-amber)]/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>

            <h2 className="mb-2 font-display text-xl font-bold text-[var(--text-primary)]">
              New to Artifacial?
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[var(--text-muted)]">
              We can walk you through creating your first AI video — which models to use, how to build a character, and how to generate your first scene. Takes about 5 minutes.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleYes}
                className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-opacity hover:opacity-90"
              >
                Yes, show me around
              </button>
              <button
                onClick={handleNo}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                No thanks, I&apos;ll figure it out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decorative icon */}
      <div className="relative mb-12">
        <div className="absolute -inset-8 rounded-full bg-[var(--accent-amber)] opacity-[0.04] blur-[60px]" />
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-full border border-[var(--border-default)]" />
          <div className="absolute inset-3 rounded-full border border-[var(--border-subtle)]" />
          <div className="absolute inset-6 rounded-full border border-dashed border-[var(--accent-amber)]/20" />
          <div className="absolute inset-9 flex items-center justify-center rounded-full bg-[var(--accent-amber-glow)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent-amber)]">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="m10 8 5 3-5 3z" />
              <line x1="2" y1="21" x2="22" y2="21" />
              <line x1="7" y1="17" x2="7" y2="21" />
              <line x1="17" y1="17" x2="17" y2="21" />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="text-center font-display text-3xl font-bold text-[var(--text-primary)]">
        Create your first video
      </h2>
      <p className="mt-4 max-w-md text-center leading-relaxed text-[var(--text-secondary)]">
        Describe a scene, pick a model, and generate a video in seconds.
        Or create a character first to use in face swaps.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <Link
          href="/generate"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 text-[var(--text-base)] font-semibold text-[var(--bg-deep)] shadow-[0_0_32px_rgba(232,166,52,0.15)] transition-all duration-300 hover:bg-[var(--accent-amber-dim)] hover:shadow-[0_0_48px_rgba(232,166,52,0.25)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="m10 8 5 3-5 3z" />
            <line x1="2" y1="21" x2="22" y2="21" />
            <line x1="7" y1="17" x2="7" y2="21" />
            <line x1="17" y1="17" x2="17" y2="21" />
          </svg>
          Start Generating
        </Link>
        <Link
          href="/characters/new"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--border-default)] px-6 py-3 text-[var(--text-base)] font-medium text-[var(--text-primary)] transition-all duration-300 hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Create Character
        </Link>
      </div>
    </div>
  );
}
