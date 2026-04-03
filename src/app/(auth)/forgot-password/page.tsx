"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success — prevents email enumeration
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grain ambient-light relative flex min-h-screen items-center justify-center bg-[var(--bg-deep)] px-4">
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--accent-amber)]">
              Artifacial
            </h1>
          </Link>
          <p className="mt-3 text-[var(--text-sm)] text-[var(--text-secondary)]">
            Reset your password
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-amber)]/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">Check your email</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  If an account exists for <strong className="text-[var(--text-secondary)]">{email}</strong>, we sent a password reset link. Check your spam folder if you don&apos;t see it.
                </p>
              </div>
              <Link
                href="/sign-in"
                className="mt-2 text-sm font-medium text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-[var(--text-muted)]">
                Enter the email address on your account and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3 text-sm text-[var(--error)]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-[var(--text-base)] font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <p className="text-center text-[var(--text-sm)] text-[var(--text-muted)]">
                Remember your password?{" "}
                <Link href="/sign-in" className="font-medium text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
