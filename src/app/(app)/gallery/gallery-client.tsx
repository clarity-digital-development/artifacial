"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

// ─── Model name lookup (client-side, matches registry) ───

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
  "wan25-preview-nsfw-t2v": "Wan 2.5 NSFW",
  "wan25-preview-nsfw-i2v": "Wan 2.5 I2V NSFW",
  "wan21-pro-nsfw-i2v": "Wan 2.1 Pro I2V",
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

const WORKFLOW_LABELS: Record<string, string> = {
  TEXT_TO_VIDEO: "T2V",
  IMAGE_TO_VIDEO: "I2V",
  TEXT_TO_IMAGE: "T2I",
  MOTION_TRANSFER: "Motion",
  UPSCALE: "Upscale",
  FACE_SWAP: "Face Swap",
  LIP_SYNC: "Lip Sync",
  BACKGROUND_REMOVAL: "BG Remove",
  VIRTUAL_TRY_ON: "Try-On",
  AI_HUG: "AI Hug",
};

// ─── Types ───

interface GalleryItem {
  id: string;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  prompt: string | null;
  modelId: string;
  workflowType: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  withAudio: boolean;
  creditsCost: number;
  generationTimeMs: number | null;
  completedAt: string;
}

// ─── Lazy visibility hook (IntersectionObserver) ───

function useLazyVisible(rootMargin = "200px"): [React.RefCallback<HTMLElement>, boolean] {
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node || isVisible) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observerRef.current?.disconnect();
          observerRef.current = null;
        }
      },
      { rootMargin }
    );
    observerRef.current.observe(node);
  }, [isVisible, rootMargin]);

  return [ref, isVisible];
}

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
      // Brief play forces mobile Safari to fetch the first frame
      video.play().then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {});
    };

    // If video already has data, force immediately
    if (video.readyState >= 2) {
      tryForce();
      return;
    }

    // Wait for enough data to play, then force
    video.addEventListener("loadeddata", tryForce, { once: true });

    // Fallback: if loadeddata never fires (preload ignored), trigger a load
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

// ─── Component ───

export function GalleryClient({ items }: { items: GalleryItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;


  return (
    <div className="flex gap-6">
      {/* Grid */}
      <div className="min-w-0 flex-1">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
            />
          ))}
        </div>
      </div>

      {/* Desktop Detail Sidebar — prompt + metadata only, no preview */}
      {selectedItem && (
        <div className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-6 space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Details
              </h3>
              <button
                onClick={() => setSelectedId(null)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Prompt */}
            {selectedItem.prompt && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Prompt
                </label>
                <p className="max-h-28 overflow-y-auto text-xs leading-relaxed text-[var(--text-secondary)]">
                  {selectedItem.prompt}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-2">
              <MetaRow label="Model" value={MODEL_NAMES[selectedItem.modelId] ?? selectedItem.modelId} />
              <MetaRow label="Type" value={WORKFLOW_LABELS[selectedItem.workflowType] ?? selectedItem.workflowType} />
              <MetaRow label="Duration" value={`${selectedItem.durationSec}s`} />
              <MetaRow label="Resolution" value={selectedItem.resolution} />
              <MetaRow label="Audio" value={selectedItem.withAudio ? "Yes" : "No"} />
              <MetaRow label="Credits" value={`${selectedItem.creditsCost}`} />
              {selectedItem.generationTimeMs && (
                <MetaRow label="Gen time" value={`${(selectedItem.generationTimeMs / 1000).toFixed(1)}s`} />
              )}
              <MetaRow
                label="Created"
                value={new Date(selectedItem.completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            </div>

            {/* Download */}
            {selectedItem.videoUrl && (
              <DownloadButton item={selectedItem} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Shared download helper ───

async function downloadItem(videoUrl: string, id: string, isImage: boolean) {
  const ext = isImage ? "webp" : "mp4";
  const mimeType = isImage ? "image/webp" : "video/mp4";
  const fileName = `artifacial-${id}.${ext}`;

  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(fileName)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], fileName, { type: mimeType });

    // On iOS/Android: use Web Share API → triggers native "Save Video / Save Image" sheet
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }

    // Desktop: blob → hidden anchor click → browser save dialog
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Last resort: open original URL so user can long-press save on mobile
    window.open(videoUrl, "_blank");
  }
}

// ─── Gallery Card ───

function GalleryCard({
  item,
  isSelected,
  onSelect,
}: {
  item: GalleryItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [lazyRef, isVisible] = useLazyVisible("200px");
  const [thumbFailed, setThumbFailed] = useState(false);

  const isImage = item.workflowType === "TEXT_TO_IMAGE";
  const hasThumbnail = !!item.thumbnailUrl && !thumbFailed;

  // Force first frame load on mobile when no working thumbnail
  useForceFirstFrame(videoRef, isVisible && !isImage && !hasThumbnail);

  // Play/pause on hover or select
  useEffect(() => {
    if (isImage) return;
    const video = videoRef.current;
    if (!video) return;

    if (isHovered || isSelected) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, isSelected, isImage]);

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const video = videoRef.current;
    if (video) {
      // iOS Safari requires webkitEnterFullscreen on the video element
      const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (v.webkitEnterFullscreen) {
        v.webkitEnterFullscreen();
      } else if (v.requestFullscreen) {
        v.requestFullscreen().catch(() => {});
      }
    } else if (isImage && item.videoUrl) {
      window.open(item.videoUrl, "_blank");
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!item.videoUrl) return;
    await downloadItem(item.videoUrl, item.id, isImage);
  };

  const modelName = MODEL_NAMES[item.modelId] ?? item.modelId;
  const workflowLabel = WORKFLOW_LABELS[item.workflowType] ?? item.workflowType;

  return (
    <div
      ref={lazyRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="block w-full cursor-pointer text-left"
    >
      <div
        className={`overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--bg-surface)] transition-all duration-200 ${
          isSelected
            ? "border-[var(--accent-amber)] ring-1 ring-[var(--accent-amber)] shadow-[0_0_20px_rgba(232,166,52,0.1)]"
            : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
        }`}
      >
        <div className={`relative overflow-hidden bg-[var(--bg-elevated)] ${
          isImage ? "aspect-square" :
          item.aspectRatio === "9:16" ? "aspect-[9/16]" :
          item.aspectRatio === "1:1" ? "aspect-square" :
          item.aspectRatio === "4:3" ? "aspect-[4/3]" :
          item.aspectRatio === "3:4" ? "aspect-[3/4]" :
          item.aspectRatio === "3:2" ? "aspect-[3/2]" :
          item.aspectRatio === "2:3" ? "aspect-[2/3]" :
          "aspect-video"
        }`}>
          {!isVisible ? (
            <div className="h-full w-full bg-[var(--bg-elevated)]" />
          ) : item.videoUrl ? (
            isImage ? (
              <img
                src={isSelected ? item.videoUrl : (item.thumbnailUrl ?? item.videoUrl)}
                alt={item.prompt ?? "Generated image"}
                className="h-full w-full object-cover"
              />
            ) : hasThumbnail ? (
              <>
                <video
                  ref={videoRef}
                  src={(isHovered || isSelected) ? item.videoUrl : undefined}
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover"
                />
                {!isHovered && !isSelected && (
                  <img
                    src={item.thumbnailUrl!}
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
                  <span className="text-[10px] text-[var(--text-muted)]">{MODEL_NAMES[item.modelId] ?? item.modelId}</span>
                </div>
                <video
                  ref={videoRef}
                  src={item.videoUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="relative h-full w-full object-cover"
                />
              </>
            )
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
              {isImage ? "Image unavailable" : "Video unavailable"}
            </div>
          )}

          {/* Hover overlay: viewfinder corners (desktop only) */}
          <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isHovered && !isSelected ? "opacity-100" : "opacity-0"}`}>
            <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[var(--accent-amber)]/50" />
            <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[var(--accent-amber)]/50" />
            <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[var(--accent-amber)]/50" />
            <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[var(--accent-amber)]/50" />
          </div>

          {/* Action buttons when selected (desktop) */}
          {isSelected && item.videoUrl && (
            <div className="absolute bottom-0 left-0 right-0 hidden items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2.5 pt-8 md:flex">
              <button
                onClick={handleSave}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70"
                title="Save"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                onClick={handleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70"
                title="Fullscreen"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Footer — model badge + metadata */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Badge variant="success">{modelName}</Badge>
          <span className="text-[10px] text-[var(--text-muted)]">
            {workflowLabel}
          </span>
          {!isImage && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {item.durationSec}s
            </span>
          )}
          {item.withAudio && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--accent-amber)]">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-[var(--text-muted)]">
            {new Date(item.completedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Mobile inline details — drops down when tapped */}
        {isSelected && (
          <div className="border-t border-[var(--border-subtle)] px-3 py-3 md:hidden">
            {/* Action buttons */}
            {item.videoUrl && (
              <div className="mb-3 flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors active:bg-[var(--bg-elevated)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Save
                </button>
                {!isImage && (
                  <button
                    onClick={handleFullscreen}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors active:bg-[var(--bg-elevated)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    Fullscreen
                  </button>
                )}
              </div>
            )}

            {/* Prompt */}
            {item.prompt && (
              <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                {item.prompt}
              </p>
            )}

            {/* Metadata */}
            <div className="space-y-1.5">
              <MetaRow label="Resolution" value={item.resolution} />
              <MetaRow label="Credits" value={`${item.creditsCost}`} />
              {item.generationTimeMs && (
                <MetaRow label="Gen time" value={`${(item.generationTimeMs / 1000).toFixed(1)}s`} />
              )}
              <MetaRow
                label="Created"
                value={new Date(item.completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Download Button ───

function DownloadButton({ item }: { item: GalleryItem }) {
  const isImage = item.workflowType === "TEXT_TO_IMAGE";

  const handleDownload = async () => {
    if (!item.videoUrl) return;
    await downloadItem(item.videoUrl, item.id, isImage);
  };

  return (
    <button
      onClick={handleDownload}
      className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-elevated)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download
    </button>
  );
}

// ─── Metadata Row ───

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}
