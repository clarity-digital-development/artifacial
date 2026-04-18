"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/studio";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/sign-in?registered=true");
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("Something went wrong");
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
            Create your account and start directing
          </p>
        </div>

        <div className="animate-fade-in-up rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {error && (
            <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
              />
            </div>
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-[var(--text-base)] font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="text-[var(--text-xs)] uppercase tracking-widest text-[var(--text-muted)]">or</span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-transparent px-4 py-3 text-[var(--text-sm)] font-medium text-[var(--text-primary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[var(--text-sm)] text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link href={callbackUrl !== "/studio" ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-in"} className="font-medium text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
