"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AUDIENCE_SIZES = [
  { value: "under_1k", label: "Under 1K" },
  { value: "1k_10k", label: "1K – 10K" },
  { value: "10k_50k", label: "10K – 50K" },
  { value: "50k_250k", label: "50K – 250K" },
  { value: "250k_plus", label: "250K+" },
];

const CONTENT_NICHES = [
  { value: "ai", label: "AI & Technology" },
  { value: "beauty_fashion", label: "Beauty & Fashion" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "gaming", label: "Gaming" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]";

const selectClass =
  "w-full appearance-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]";

export default function ApplyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [platformLink, setPlatformLink] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [niche, setNiche] = useState("");
  const [whyPartner, setWhyPartner] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState("");

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase, alphanumeric only
    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20);
    setCode(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 3) {
      setError("Promo code must be at least 3 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, platformLink, audienceSize, niche, whyPartner }),
      });
      const data = await res.json();
      if (res.status === 401) {
        // Not logged in — redirect to sign-in
        router.push(`/sign-in?callbackUrl=/apply`);
        return;
      }
      if (!res.ok) {
        if (data.error?.toLowerCase().includes("code")) {
          setError("That promo code is already taken. Try a different one.");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setAffiliateCode(data.affiliate?.code ?? code);
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Success State ───
  if (success) {
    return (
      <div className="grain ambient-light relative flex min-h-screen items-center justify-center bg-[var(--bg-deep)] px-4">
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-block">
              <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--accent-amber)]">
                Artifacial
              </h1>
            </Link>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--success)]/20 bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--success)]/20 bg-[var(--success)]/10">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--success)]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Application submitted!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Welcome to the Artifacial Creator Program. Your promo code{" "}
              <span className="font-mono font-semibold text-[var(--accent-amber)]">
                {affiliateCode}
              </span>{" "}
              is being reviewed — you&apos;ll hear from us within 1–2 business
              days.
            </p>
            <div className="mt-5 space-y-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                What happens next
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-amber)]">1.</span>
                  Our team reviews your application (1–2 business days)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-amber)]">2.</span>
                  You receive an approval email with your affiliate link
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-amber)]">3.</span>
                  Share your code and start earning 20% per referral
                </li>
              </ul>
            </div>
            <Link
              href="/studio"
              className="mt-6 block w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-center text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)]"
            >
              Go to Studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="grain ambient-light relative flex min-h-screen items-center justify-center bg-[var(--bg-deep)] px-4 py-12">
      <div className="relative z-10 w-full max-w-[500px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--accent-amber)]">
              Artifacial
            </h1>
          </Link>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Creator Program Application
          </p>
        </div>

        {/* Teaser stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { value: "20%", label: "Commission" },
            { value: "12 mo", label: "Per referral" },
            { value: "$50", label: "Min payout" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-3 text-center"
            >
              <p className="text-lg font-bold text-[var(--accent-amber)]">{s.value}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {error && (
            <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Promo code */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code" className="text-xs font-medium text-[var(--text-secondary)]">
                Your Promo Code
                <span className="ml-1 text-[var(--error)]">*</span>
              </label>
              <input
                id="code"
                type="text"
                required
                value={code}
                onChange={handleCodeChange}
                placeholder="YOURNAME"
                minLength={3}
                maxLength={20}
                className={`${inputClass} font-mono tracking-wider`}
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                Alphanumeric only, 3–20 characters. This is what your audience
                types at checkout — choose your name or brand. Auto-uppercased.
              </p>
            </div>

            {/* Platform link */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="platform" className="text-xs font-medium text-[var(--text-secondary)]">
                Platform Link
                <span className="ml-1 text-[var(--error)]">*</span>
              </label>
              <input
                id="platform"
                type="url"
                required
                value={platformLink}
                onChange={(e) => setPlatformLink(e.target.value)}
                placeholder="https://tiktok.com/@yourhandle"
                className={inputClass}
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                Your TikTok, Instagram, or YouTube channel URL.
              </p>
            </div>

            {/* Audience size */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="audience" className="text-xs font-medium text-[var(--text-secondary)]">
                Audience Size
                <span className="ml-1 text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <select
                  id="audience"
                  required
                  value={audienceSize}
                  onChange={(e) => setAudienceSize(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Select your audience size
                  </option>
                  {AUDIENCE_SIZES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Content niche */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="niche" className="text-xs font-medium text-[var(--text-secondary)]">
                Content Niche
                <span className="ml-1 text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <select
                  id="niche"
                  required
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Select your niche
                  </option>
                  {CONTENT_NICHES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Why partner */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="why" className="text-xs font-medium text-[var(--text-secondary)]">
                Why do you want to partner?
                <span className="ml-1 text-[var(--error)]">*</span>
              </label>
              <textarea
                id="why"
                required
                value={whyPartner}
                onChange={(e) => setWhyPartner(e.target.value)}
                placeholder="Tell us about your audience and how you'd promote Artifacial..."
                rows={4}
                minLength={30}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
            Already an affiliate?{" "}
            <Link
              href="/affiliate"
              className="font-medium text-[var(--accent-amber)] transition-colors hover:text-[var(--accent-amber-dim)]"
            >
              Go to your dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
