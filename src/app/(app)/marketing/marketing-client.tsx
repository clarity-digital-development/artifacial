"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mode = "ugc" | "tv-spot" | "hyper-motion";

interface ScrapedProduct {
  name: string;
  description: string;
  imageUrl: string | null;
  additionalImages: string[];
  brand: string | null;
  price: string | null;
  source: string;
  sourceUrl: string;
}

interface PollResult {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  progress?: number;
}

const MODES: Array<{ key: Mode; title: string; tagline: string; needsCreator: boolean; aspect: string }> = [
  { key: "ugc", title: "UGC", tagline: "Phone-style creator ad — real person talking to camera", needsCreator: true, aspect: "9:16" },
  { key: "tv-spot", title: "TV Spot", tagline: "Cinematic 16:9 brand commercial", needsCreator: true, aspect: "16:9" },
  { key: "hyper-motion", title: "Hyper Motion", tagline: "Pure CGI product-hero shot — no human needed", needsCreator: false, aspect: "9:16" },
];

export function MarketingClient({ totalCredits }: { totalCredits: number }) {
  const [step, setStep] = useState<"input" | "preview" | "generating" | "done" | "error">("input");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("ugc");
  const [notes, setNotes] = useState("");
  const [creatorImage, setCreatorImage] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [product, setProduct] = useState<ScrapedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generation state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [hook, setHook] = useState("");
  const [spokenScript, setSpokenScript] = useState("");
  const [pollResult, setPollResult] = useState<PollResult | null>(null);

  // ── Step 1: Scrape ─────────────────────────────────────────────────────────
  const handleScrape = async () => {
    if (!url.trim()) return;
    setScrapeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load that URL");
      setProduct(data.product as ScrapedProduct);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scrape URL");
    } finally {
      setScrapeLoading(false);
    }
  };

  // ── Step 2: Submit ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!product) return;
    const modeConfig = MODES.find((m) => m.key === mode)!;
    if (modeConfig.needsCreator && !creatorImage) {
      setError("Upload a creator photo first.");
      return;
    }
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, creatorImage, mode, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate ad");
      setGenerationId(data.generationId);
      setTaskId(data.taskId);
      setHook(data.hook ?? "");
      setSpokenScript(data.spokenScript ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ad");
      setStep("error");
    }
  };

  // ── Step 3: Poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId || !generationId || step !== "generating") return;
    const interval = setInterval(async () => {
      try {
        const qs = new URLSearchParams({ taskId, generationId });
        const res = await fetch(`/api/workshop/poll?${qs.toString()}`);
        const data: PollResult = await res.json();
        if (data.status === "completed") {
          setPollResult(data);
          setStep("done");
        } else if (data.status === "failed") {
          setError(data.errorMessage ?? "Generation failed");
          setStep("error");
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId, generationId, step]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
          Marketing Studio
        </p>
        <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">
          Add a link. Watch ads create themselves.
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Paste a product URL — we&apos;ll write the script and generate the video. 2,000 cr per ad.
        </p>
      </div>

      {/* Step 1 — URL */}
      {step === "input" && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Product URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstore.com/products/widget"
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] focus:outline-none"
            />
            <button
              onClick={handleScrape}
              disabled={!url.trim() || scrapeLoading}
              className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90"
            >
              {scrapeLoading ? "Loading…" : "Load product"}
            </button>
          </div>
          {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
          <p className="mt-4 text-[11px] text-[var(--text-muted)]">
            Works on Shopify, WooCommerce, and most DTC brand sites. We extract title, description,
            image, and price automatically.
          </p>
        </div>
      )}

      {/* Step 2 — Preview + mode pick */}
      {step === "preview" && product && (
        <div className="space-y-6">
          {/* Product preview */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Product
              </h2>
              <button
                onClick={() => { setStep("input"); setProduct(null); }}
                className="text-[11px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
              >
                Change
              </button>
            </div>
            <div className="mt-4 flex gap-4">
              {product.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-24 w-24 flex-shrink-0 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[var(--text-primary)]">{product.name}</p>
                {product.brand && <p className="text-[12px] text-[var(--text-muted)]">{product.brand}</p>}
                {product.description && (
                  <p className="mt-2 line-clamp-2 text-[13px] text-[var(--text-secondary)]">{product.description}</p>
                )}
                <p className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Source: {product.source}{product.price ? ` · ${product.price}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Mode picker */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Ad style
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`rounded-[var(--radius-md)] border p-4 text-left transition-colors ${
                    mode === m.key
                      ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 hover:border-[var(--border-default)]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{m.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{m.tagline}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{m.aspect}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Creator photo (skip for hyper-motion) */}
          {MODES.find((m) => m.key === mode)?.needsCreator && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Creator photo
              </h2>
              <p className="mb-3 text-[12px] text-[var(--text-secondary)]">
                Upload a photo of the person who will appear in the ad. Front-facing portrait works best.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCreatorImage(reader.result as string);
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--accent-amber)] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-black hover:file:opacity-90"
              />
              {creatorImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={creatorImage}
                  alt="Creator"
                  className="mt-3 h-20 w-20 rounded-[var(--radius-md)] border border-[var(--border-subtle)] object-cover"
                />
              )}
            </div>
          )}

          {/* Optional notes */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Creative direction (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="emphasize the morning routine angle / focus on the texture / call out the price drop"
              className="block w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] focus:outline-none"
            />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            className="block w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-4 text-base font-semibold text-black hover:opacity-90"
          >
            Generate ad — 2,000 cr
          </button>
        </div>
      )}

      {/* Step 3 — Generating */}
      {step === "generating" && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
            <p className="text-sm text-[var(--text-secondary)]">Generating your ad — typically 60–90 s…</p>
          </div>
          {hook && (
            <div className="mt-6 space-y-3 text-[13px]">
              <p>
                <span className="mr-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Hook</span>
                <span className="text-[var(--text-primary)]">{hook}</span>
              </p>
              <p>
                <span className="mr-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Script</span>
                <span className="text-[var(--text-secondary)]">{spokenScript}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Done */}
      {step === "done" && pollResult?.videoUrl && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">Hook</p>
            <p className="font-display text-xl font-bold text-[var(--text-primary)]">{hook}</p>
            {spokenScript && (
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">{spokenScript}</p>
            )}
          </div>
          <video
            src={pollResult.videoUrl}
            controls
            autoPlay
            playsInline
            loop
            className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-black"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep("input"); setUrl(""); setProduct(null); setCreatorImage(null); setNotes("");
                setGenerationId(null); setTaskId(null); setHook(""); setSpokenScript(""); setPollResult(null);
              }}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
            >
              New campaign
            </button>
            <Link
              href="/gallery"
              className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              View in Gallery
            </Link>
          </div>
        </div>
      )}

      {/* Step 5 — Error */}
      {step === "error" && (
        <div className="rounded-[var(--radius-lg)] border border-red-500/30 bg-[var(--bg-surface)] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Generation failed</p>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{error}</p>
          <button
            onClick={() => { setStep(product ? "preview" : "input"); setError(null); }}
            className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
