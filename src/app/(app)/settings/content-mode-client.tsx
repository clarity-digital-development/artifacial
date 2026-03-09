"use client";

import { useState } from "react";

interface ContentModeClientProps {
  contentMode: string;
  hasDateOfBirth: boolean;
}

export function ContentModeClient({
  contentMode: initialMode,
  hasDateOfBirth,
}: ContentModeClientProps) {
  const [mode, setMode] = useState(initialMode);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNsfw = mode === "NSFW";

  const enableNsfw = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/content-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMode: "NSFW" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update");
      }
      setMode("NSFW");
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (isNsfw) {
      // Disabling NSFW — immediate, no confirmation
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings/content-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentMode: "SFW" }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to update");
        }
        setMode("SFW");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    } else {
      // Enabling NSFW — show confirmation modal
      setShowModal(true);
    }
  };

  const handleConfirmYes = async () => {
    if (hasDateOfBirth) {
      // Already verified — just enable
      await enableNsfw();
    } else {
      // First time — server will store the confirmation
      await enableNsfw();
    }
  };

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Creative Freedom
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Mature Content Mode
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {isNsfw
                ? "Unrestricted generation enabled. Age-verified characters only."
                : "Standard mode. Enable for unrestricted creative freedom."}
            </p>
          </div>

          <button
            onClick={handleToggle}
            disabled={loading}
            className={`
              relative h-7 w-12 rounded-full transition-colors duration-200
              ${isNsfw
                ? "bg-[var(--accent-amber)]"
                : "bg-[var(--border-default)]"
              }
              disabled:opacity-50
            `}
          >
            <span
              className={`
                absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm
                transition-transform duration-200
                ${isNsfw ? "translate-x-[22px]" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-[var(--error)]">{error}</p>
        )}
      </div>

      {/* Age Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Age Verification
            </h3>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Mature content is restricted to users 18 years or older. By continuing, you confirm that you are at least 18.
            </p>

            {error && (
              <p className="mt-3 text-xs text-[var(--error)]">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                No, I&apos;m under 18
              </button>
              <button
                onClick={handleConfirmYes}
                disabled={loading}
                className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "Enabling..." : "Yes, I'm 18+"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
