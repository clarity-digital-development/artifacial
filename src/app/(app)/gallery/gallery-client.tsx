"use client";

import { useState, useRef, useEffect } from "react";
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
  prompt: string | null;
  modelId: string;
  workflowType: string;
  resolution: string;
  durationSec: number;
  withAudio: boolean;
  creditsCost: number;
  generationTimeMs: number | null;
  completedAt: string;
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

      {/* Detail Sidebar */}
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

            {/* Preview */}
            {selectedItem.videoUrl && (
              <div className="overflow-hidden rounded-[var(--radius-md)]">
                {selectedItem.workflowType === "TEXT_TO_IMAGE" ? (
                  <img
                    src={selectedItem.videoUrl}
                    alt={selectedItem.prompt ?? "Generated image"}
                    className="w-full object-cover"
                  />
                ) : (
                  <video
                    src={selectedItem.videoUrl}
                    className="w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
              </div>
            )}

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

            {/* Actions */}
            {selectedItem.videoUrl && (
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = selectedItem.videoUrl!;
                  const ext = selectedItem.workflowType === "TEXT_TO_IMAGE" ? "webp" : "mp4";
                  a.download = `artifacial-${selectedItem.id}.${ext}`;
                  a.click();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-elevated)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

  const isImage = item.workflowType === "TEXT_TO_IMAGE";

  useEffect(() => {
    if (isImage) return;
    const video = videoRef.current;
    if (!video) return;

    if (isHovered) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, isImage]);

  const modelName = MODEL_NAMES[item.modelId] ?? item.modelId;
  const workflowLabel = WORKFLOW_LABELS[item.workflowType] ?? item.workflowType;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="block w-full text-left"
    >
      <div
        className={`overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--bg-surface)] transition-all duration-200 ${
          isSelected
            ? "border-[var(--accent-amber)] ring-1 ring-[var(--accent-amber)] shadow-[0_0_20px_rgba(232,166,52,0.1)]"
            : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
        }`}
      >
        <div className={`relative ${isImage ? "aspect-square" : "aspect-video"} overflow-hidden bg-[var(--bg-elevated)]`}>
          {item.videoUrl ? (
            isImage ? (
              <img
                src={item.videoUrl}
                alt={item.prompt ?? "Generated image"}
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                src={item.videoUrl}
                muted
                loop
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
              {isImage ? "Image unavailable" : "Video unavailable"}
            </div>
          )}

          {/* Hover overlay: viewfinder corners */}
          <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[var(--accent-amber)]/50" />
            <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[var(--accent-amber)]/50" />
            <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[var(--accent-amber)]/50" />
            <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[var(--accent-amber)]/50" />
          </div>
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
      </div>
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
