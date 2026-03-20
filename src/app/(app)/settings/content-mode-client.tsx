"use client";

import { useState } from "react";
import Link from "next/link";

interface ContentModeClientProps {
  contentMode: string;
  hasDateOfBirth: boolean;
  subscriptionTier: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ContentModeClient({
  contentMode: initialMode,
  hasDateOfBirth,
  subscriptionTier,
}: ContentModeClientProps) {
  const [mode, setMode] = useState(initialMode);
  const [showModal, setShowModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFree = subscriptionTier === "FREE";

  // DOB picker state
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const isNsfw = mode === "NSFW";

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
    } else if (isFree) {
      // Free tier — show paywall modal
      setShowPaywall(true);
      return;
    } else if (hasDateOfBirth) {
      // Already age-verified — just enable
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    } else {
      // First time — show DOB modal
      setShowModal(true);
      setError(null);
    }
  };

  const handleSubmitDOB = async () => {
    setError(null);

    if (!month || !day || !year) {
      setError("Please select your full date of birth");
      return;
    }

    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);

    // Basic client-side validation
    const dob = new Date(yearNum, monthNum - 1, dayNum);
    if (
      dob.getFullYear() !== yearNum ||
      dob.getMonth() !== monthNum - 1 ||
      dob.getDate() !== dayNum
    ) {
      setError("Invalid date");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings/content-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentMode: "NSFW",
          dateOfBirth: dob.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to verify age");
      }
      setMode("NSFW");
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Generate day options based on selected month/year
  const currentYear = new Date().getFullYear();
  const daysInMonth =
    month && year
      ? new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
      : 31;

  const selectClass =
    "h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-amber)]";

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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

          <div className="flex items-center gap-2">
            {isFree && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Starter+
              </span>
            )}
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
        </div>

        {error && !showModal && (
          <p className="mt-3 text-xs text-[var(--error)]">{error}</p>
        )}
      </div>

      {/* DOB Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Age Verification
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Mature content requires age verification. Enter your date of birth to continue.
            </p>

            <div className="mt-5 flex gap-2">
              {/* Month */}
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={`${selectClass} flex-[3]`}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Day */}
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={`${selectClass} flex-[2]`}
              >
                <option value="">Day</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (d) => (
                    <option key={d} value={String(d)}>
                      {d}
                    </option>
                  )
                )}
              </select>

              {/* Year */}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={`${selectClass} flex-[2]`}
              >
                <option value="">Year</option>
                {Array.from(
                  { length: 100 },
                  (_, i) => currentYear - i
                ).map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Your date of birth is stored securely and cannot be changed once submitted.
            </p>

            {error && (
              <p className="mt-3 text-xs text-[var(--error)]">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                  setMonth("");
                  setDay("");
                  setYear("");
                }}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDOB}
                disabled={loading || !month || !day || !year}
                className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paywall Modal — Free tier users */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-amber)]">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Unlock Creative Freedom
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Mature content is available on Starter ($15/mo) and above.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Maybe Later
              </button>
              <Link
                href="/pricing"
                className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-center text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
