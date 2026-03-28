"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

// ─── Force first frame on mobile (play→pause trick) ───

function useForceFirstFrame(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean
) {
  const forced = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || forced.current) return;

    const tryForce = () => {
      if (forced.current) return;
      forced.current = true;
      video.play().then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {});
    };

    if (video.readyState >= 2) {
      tryForce();
      return;
    }

    video.addEventListener("loadeddata", tryForce, { once: true });

    const timer = setTimeout(() => {
      if (!forced.current && video.readyState < 2) {
        video.load();
      }
    }, 500);

    return () => {
      video.removeEventListener("loadeddata", tryForce);
      clearTimeout(timer);
    };
  }, [videoRef, enabled]);
}

// ─── Model name lookup ───

const MODEL_NAMES: Record<string, string> = {
  "wan-22": "Wan 2.2",
  "wan-26": "Wan 2.6",
  "framepack": "Framepack",
  "kling-26-std": "Kling 2.6",
  "seedance-2": "Seedance 2",
  "sora-2": "Sora 2",
  "kling-26-pro": "Kling 2.6 Pro",
  "kling-30-pro": "Kling 3.0 Pro",
  "sora-2-pro": "Sora 2 Pro",
  "veo-31": "Veo 3.1",
  "seedance-2-pro": "Seedance 2 Pro",
  "kling-26-motion-std": "Motion Std",
  "kling-26-motion-pro": "Motion Pro",
  "wan22-nsfw-t2v": "Wan 2.2 NSFW",
  "wan22-nsfw-i2v": "Wan 2.2 I2V",
  "wan26-nsfw-t2v": "Wan 2.6 NSFW",
  "wan26-nsfw-i2v": "Wan 2.6 I2V",
  "z-image-turbo": "Z-Image Turbo",
  "flux-schnell": "Flux Schnell",
  "qwen-image": "Qwen Image",
  "seedream-5": "Seedream 5",
  // Post-processing
  "piapi-face-swap": "Face Swap",
  "piapi-video-face-swap": "Video Face Swap",
  "piapi-background-removal": "BG Remove",
  "piapi-virtual-try-on": "Try-On",
  "piapi-ai-hug": "AI Hug",
};

const STATUS_VARIANT: Record<string, "default" | "amber" | "success" | "error"> = {
  QUEUED: "default",
  PROCESSING: "amber",
  COMPLETED: "success",
  FAILED: "error",
  BLOCKED: "error",
};

// ─── Types ───

interface GenerationCard {
  id: string;
  status: string;
  modelId: string;
  workflowType: string;
  durationSec: number;
  withAudio: boolean;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  progress: number;
  prompt: string;
  completedAt: string;
}

// ─── Mobile Thumbnail (with broken-image fallback) ───

function MobileThumbnail({ thumbnailUrl, modelId }: { thumbnailUrl: string | null; modelId: string }) {
  const [failed, setFailed] = useState(false);
  const modelName = MODEL_NAMES[modelId] ?? modelId;

  if (thumbnailUrl && !failed) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-[var(--bg-elevated)]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-white/60">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <span className="text-[9px] text-[var(--text-muted)]">{modelName}</span>
    </div>
  );
}

// ─── Component ───

export function RecentGenerations({ generations }: { generations: GenerationCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Recent Generations
          </h2>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {generations.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/gallery"
            className="mr-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-amber)]"
          >
            View All
          </Link>
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
            aria-label="Scroll left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
            aria-label="Scroll right"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile grid — show up to 3 generations + "New" CTA (4 cells total) */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Link href="/generate" className="flex aspect-[3/2] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent-amber)]">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="text-xs text-[var(--text-muted)]">New Generation</span>
          </div>
        </Link>
        {generations.slice(0, 3).map((g) => (
          <Link key={g.id} href="/generate" className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {g.videoUrl ? (
              <MobileThumbnail thumbnailUrl={g.thumbnailUrl ?? null} modelId={g.modelId} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                {g.status === "COMPLETED" ? "No preview" : g.status}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="truncate text-[10px] text-white/70">{g.modelId}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop horizontal scroll — hide on mobile */}
      <div
        ref={scrollRef}
        className="hidden md:flex scrollbar-none snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {/* New Generation CTA */}
        <Link href="/generate" className="shrink-0 snap-start">
          <div className="group flex h-[200px] w-[300px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--accent-amber)]/40 hover:bg-[var(--bg-elevated)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/40 text-[var(--accent-amber)] transition-all duration-300 group-hover:border-[var(--accent-amber)] group-hover:bg-[var(--accent-amber-glow)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              New Generation
            </span>
          </div>
        </Link>

        {generations.map((gen) => (
          <GenerationCardItem key={gen.id} gen={gen} />
        ))}
      </div>
    </section>
  );
}

// ─── Generation Card ───

function GenerationCardItem({ gen }: { gen: GenerationCard }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const hasThumbnail = !!gen.thumbnailUrl && !thumbFailed;

  // Force first frame on mobile when no working thumbnail
  useForceFirstFrame(videoRef, gen.status === "COMPLETED" && !!gen.videoUrl && !hasThumbnail);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || gen.status !== "COMPLETED") return;

    if (isHovered) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, gen.status]);

  const modelName = MODEL_NAMES[gen.modelId] ?? gen.modelId;
  const isInFlight = gen.status === "QUEUED" || gen.status === "PROCESSING";

  return (
    <Link
      href={gen.status === "COMPLETED" ? "/gallery" : "/generate"}
      className="shrink-0 snap-start"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="group h-[200px] w-[300px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="relative h-[152px] overflow-hidden bg-[var(--bg-elevated)]">
          {gen.status === "COMPLETED" && gen.videoUrl ? (
            <>
              {hasThumbnail ? (
                <>
                  <video
                    ref={videoRef}
                    src={isHovered ? gen.videoUrl : undefined}
                    muted
                    loop
                    playsInline
                    preload="none"
                    className="h-full w-full object-cover"
                  />
                  {!isHovered && (
                    <img
                      src={gen.thumbnailUrl!}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => setThumbFailed(true)}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg-elevated)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 text-white/60">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{modelName}</span>
                  </div>
                  <video
                    ref={videoRef}
                    src={gen.videoUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="relative h-full w-full object-cover"
                  />
                </>
              )}
              {/* Viewfinder corners on hover */}
              <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
                <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[var(--accent-amber)]/50" />
                <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[var(--accent-amber)]/50" />
                <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[var(--accent-amber)]/50" />
                <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[var(--accent-amber)]/50" />
              </div>
            </>
          ) : gen.status === "FAILED" || gen.status === "BLOCKED" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--error)]/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className="text-xs text-[var(--error)]">Failed</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--border-default)" strokeWidth="2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium capitalize text-[var(--text-secondary)]">
                {gen.status === "QUEUED" ? "In queue" : "Processing"}
              </p>
              {isInFlight && gen.progress > 0 && (
                <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-amber)] transition-all duration-500"
                    style={{ width: `${gen.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Badge variant={STATUS_VARIANT[gen.status] ?? "default"}>
            {modelName}
          </Badge>
          <span className="text-[10px] text-[var(--text-muted)]">
            {gen.durationSec}s
          </span>
          {gen.withAudio && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--accent-amber)]">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-[var(--text-muted)]">
            {new Date(gen.completedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
