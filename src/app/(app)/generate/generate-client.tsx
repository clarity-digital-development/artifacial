"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { UploadZone } from "@/components/upload-zone";

// ─── Client-side model data (mirrors registry.ts for use in the browser) ───

type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
type ModelMode = "T2V" | "I2V" | "MOTION_TRANSFER";
type ModelContentMode = "SFW" | "NSFW" | "BOTH";

type ClientModel = {
  id: string;
  name: string;
  provider: "FAL" | "SELF_HOSTED";
  tier: ModelTier;
  creditCost: number;
  supportedModes: ModelMode[];
  maxDuration: number;
  maxResolution: string;
  supportsAudio: boolean;
  contentMode: ModelContentMode;
  description: string;
};

const MODELS: ClientModel[] = [
  // ── SFW Budget ──
  { id: "ltx-19b", name: "LTX 19B", provider: "FAL", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Fast and affordable. Great for quick iterations." },
  { id: "wan-26", name: "Wan 2.6", provider: "FAL", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 15, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Long-form budget option. Up to 15 seconds." },
  // ── SFW Standard ──
  { id: "hailuo-23", name: "Hailuo 2.3", provider: "FAL", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 6, maxResolution: "768p", supportsAudio: false, contentMode: "SFW", description: "Smooth motion. Great for social content." },
  { id: "seedance-15", name: "Seedance 1.5 Pro", provider: "FAL", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 12, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Versatile with long duration support." },
  { id: "kling-25-turbo", name: "Kling 2.5 Turbo", provider: "FAL", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Fast and reliable. Our default model." },
  // ── SFW Ultra ──
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "FAL", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 25, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "OpenAI's flagship. Up to 25 seconds." },
  { id: "kling-30-pro", name: "Kling 3.0 Pro", provider: "FAL", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 15, maxResolution: "4K", supportsAudio: true, contentMode: "SFW", description: "Premium quality. 4K with audio." },
  { id: "veo-31", name: "Veo 3.1", provider: "FAL", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 8, maxResolution: "4K", supportsAudio: true, contentMode: "SFW", description: "Google's best. 4K cinematic output." },
  // ── Motion Control ──
  { id: "kling-26-motion-std", name: "Kling 2.6 Motion (Standard)", provider: "FAL", tier: "STANDARD", creditCost: 1, supportedModes: ["MOTION_TRANSFER"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Copy motion from reference video. Standard quality." },
  { id: "kling-26-motion-pro", name: "Kling 2.6 Motion (Pro)", provider: "FAL", tier: "ULTRA", creditCost: 2, supportedModes: ["MOTION_TRANSFER"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Copy motion from reference video. Pro quality." },
  // ── NSFW ──
  { id: "wan22-nsfw-t2v", name: "Wan 2.2 NSFW", provider: "SELF_HOSTED", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted text-to-video. Self-hosted." },
  { id: "wan22-nsfw-i2v", name: "Wan 2.2 NSFW", provider: "SELF_HOSTED", tier: "STANDARD", creditCost: 1, supportedModes: ["I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted image-to-video. Self-hosted." },
  { id: "wan22-nsfw-t2v-lite", name: "Wan 2.2 NSFW Lite", provider: "SELF_HOSTED", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Fast unrestricted generation. Lower VRAM." },
];

const TIER_LABELS: Record<ModelTier, string> = {
  BUDGET: "Budget",
  STANDARD: "Standard",
  ULTRA: "Ultra",
};

const TIER_ORDER: Record<ModelTier, number> = { BUDGET: 0, STANDARD: 1, ULTRA: 2 };

const MAX_CONCURRENT = 3;

// ─── Generation Item Type ───

type GenerationItem = {
  id: string;
  generationId: string | null;
  status: "submitting" | "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  generationTimeMs?: number;
  modelId: string;
  modelName: string;
  prompt: string;
  durationSec: number;
  withAudio: boolean;
  creditCost: number;
  createdAt: number;
  elapsedSec: number;
  parentGenerationId?: string;
  postProcessType?: string;
  resolution?: string;
};

type ModeTab = "T2V" | "I2V" | "MOTION_TRANSFER";

type CharacterOption = {
  id: string;
  name: string;
  style: string;
  thumbnailUrl: string | null;
  referenceImageKey: string | null;
};

interface GenerateClientProps {
  totalCredits: number;
  tier: string;
  characters?: CharacterOption[];
  contentMode?: string;
}

// ─── Component ───

export function GenerateClient({ totalCredits, tier, characters = [], contentMode = "SFW" }: GenerateClientProps) {
  const isFree = tier === "FREE";
  const isNsfw = contentMode === "NSFW" && !isFree;
  const userContentMode = isNsfw ? "NSFW" : "SFW";

  // Filter models based on content mode
  const availableModels = MODELS.filter((m) => {
    if (userContentMode === "SFW") return m.contentMode === "SFW" || m.contentMode === "BOTH";
    return true; // NSFW users see both SFW and NSFW models
  });

  // Mode & model
  const [mode, setMode] = useState<ModeTab>("T2V");
  const [selectedModelId, setSelectedModelId] = useState<string>(isNsfw ? "wan22-nsfw-t2v" : "kling-30-pro");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(5);
  const [withAudio, setWithAudio] = useState(false);
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("image");

  // Character picker for I2V
  const [imageSource, setImageSource] = useState<"upload" | "character">("upload");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? null;

  // Generation feed
  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credits, setCredits] = useState(totalCredits);

  // Refs for polling intervals
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const timerRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // ─── Derived ───

  const filteredModels = availableModels.filter((m) => m.supportedModes.includes(mode));

  // Group by tier for display
  const modelGroups = (["BUDGET", "STANDARD", "ULTRA"] as ModelTier[])
    .map((t) => ({
      tier: t,
      label: `${TIER_LABELS[t]} (${t === "ULTRA" ? "2 credits" : "1 credit"})`,
      models: filteredModels.filter((m) => m.tier === t),
    }))
    .filter((g) => g.models.length > 0);

  const selectedModel = availableModels.find((m) => m.id === selectedModelId) ?? filteredModels[0];

  // Credit cost: base * duration multiplier
  const durationMultiplier = Math.ceil(durationSec / 5);
  const creditCost = selectedModel ? selectedModel.creditCost * durationMultiplier : 1;
  const canAfford = credits >= creditCost;

  // Available durations based on model
  const allDurations = [3, 5, 6, 8, 10, 12, 15, 25];
  const availableDurations = selectedModel
    ? allDurations.filter((d) => d <= selectedModel.maxDuration)
    : [3, 5];

  const isMotionMode = mode === "MOTION_TRANSFER";
  const needsImage = isMotionMode || (selectedModel && mode === "I2V");
  const needsVideo = isMotionMode;

  const inFlightCount = generations.filter(
    (g) => g.status === "submitting" || g.status === "queued" || g.status === "processing"
  ).length;

  const selectedGeneration = generations.find((g) => g.id === selectedId) ?? null;

  // When mode changes, select the best default model for that mode
  useEffect(() => {
    const defaults: Record<string, Record<ModeTab, string>> = {
      SFW: { T2V: "kling-30-pro", I2V: "kling-30-pro", MOTION_TRANSFER: "kling-26-motion-std" },
      NSFW: { T2V: "wan22-nsfw-t2v", I2V: "wan22-nsfw-i2v", MOTION_TRANSFER: "kling-26-motion-std" },
    };
    const defaultId = defaults[userContentMode]?.[mode];
    const target = filteredModels.find((m) => m.id === defaultId) ?? filteredModels[0];
    if (target) {
      setSelectedModelId(target.id);
      setWithAudio(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // When model changes, clamp duration
  useEffect(() => {
    if (selectedModel && durationSec > selectedModel.maxDuration) {
      // Pick closest available
      const closest = availableDurations[availableDurations.length - 1] ?? 5;
      setDurationSec(closest);
    }
    if (selectedModel && !selectedModel.supportsAudio) {
      setWithAudio(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelDropdownOpen]);

  // Handle image file
  const handleImageFile = useCallback((file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const clearImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }, [imagePreview]);

  // Handle video file (motion transfer)
  const handleVideoFile = useCallback((file: File) => {
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }, []);

  const clearVideo = useCallback(() => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
  }, [videoPreview]);

  // ─── Polling per generation ───

  const stopPollingFor = useCallback((itemId: string) => {
    const poll = pollRefs.current.get(itemId);
    if (poll) { clearInterval(poll); pollRefs.current.delete(itemId); }
    const timer = timerRefs.current.get(itemId);
    if (timer) { clearInterval(timer); timerRefs.current.delete(itemId); }
  }, []);

  const startPollingFor = useCallback((itemId: string, generationId: string) => {
    timerRefs.current.set(
      itemId,
      setInterval(() => {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === itemId && (g.status === "queued" || g.status === "processing" || g.status === "submitting")
              ? { ...g, elapsedSec: Math.floor((Date.now() - g.createdAt) / 1000) }
              : g
          )
        );
      }, 1000)
    );

    const poll = async () => {
      try {
        const res = await fetch(`/api/generate/${generationId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        setGenerations((prev) =>
          prev.map((g) => {
            if (g.id !== itemId) return g;

            const newStatus =
              data.status === "COMPLETED" ? "completed" as const :
              data.status === "FAILED" || data.status === "BLOCKED" ? "failed" as const :
              data.status === "PROCESSING" ? "processing" as const :
              "queued" as const;

            const updated = {
              ...g,
              status: newStatus,
              progress: data.progress ?? g.progress,
              outputUrl: data.outputUrl ?? g.outputUrl,
              thumbnailUrl: data.thumbnailUrl ?? g.thumbnailUrl,
              errorMessage: data.errorMessage ?? g.errorMessage,
              generationTimeMs: data.generationTimeMs ?? g.generationTimeMs,
            };

            if (newStatus === "completed" || newStatus === "failed") {
              stopPollingFor(itemId);
            }

            return updated;
          })
        );
      } catch {
        // Retry silently
      }
    };

    poll();
    pollRefs.current.set(itemId, setInterval(poll, 3000));
  }, [stopPollingFor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollRefs.current.forEach((interval) => clearInterval(interval));
      timerRefs.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // ─── Submit ───

  const handleSubmit = async () => {
    if (submitting || !canAfford || !prompt.trim() || inFlightCount >= MAX_CONCURRENT) return;

    const itemId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newItem: GenerationItem = {
      id: itemId,
      generationId: null,
      status: "submitting",
      progress: 0,
      modelId: selectedModel.id,
      modelName: selectedModel.name,
      prompt: prompt.trim(),
      durationSec,
      withAudio: withAudio && selectedModel.supportsAudio,
      creditCost,
      createdAt: Date.now(),
      elapsedSec: 0,
    };

    setGenerations((prev) => [newItem, ...prev]);
    setSelectedId(itemId);
    setSubmitting(true);

    try {
      let imageUrl: string | undefined;
      if (needsImage && imageSource === "character" && selectedCharacter?.referenceImageKey) {
        // Pass R2 key prefixed with "r2:" so the API knows to sign it server-side
        imageUrl = `r2:${selectedCharacter.referenceImageKey}`;
      } else if (needsImage && imageFile) {
        imageUrl = await fileToDataUrl(imageFile);
      }

      let videoUrl: string | undefined;
      if (needsVideo && videoFile) {
        videoUrl = await fileToDataUrl(videoFile);
      }

      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        modelId: selectedModel.id,
        durationSec,
        withAudio: withAudio && selectedModel.supportsAudio,
      };
      if (imageUrl) body.imageUrl = imageUrl;
      if (videoUrl) body.videoUrl = videoUrl;
      if (isMotionMode) body.characterOrientation = characterOrientation;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === itemId
              ? { ...g, status: "failed" as const, errorMessage: data.error || "Failed to start generation" }
              : g
          )
        );
        return;
      }

      setCredits((c) => c - creditCost);
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === itemId
            ? { ...g, generationId: data.generationId, status: "queued" as const }
            : g
        )
      );

      startPollingFor(itemId, data.generationId);
    } catch (err) {
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === itemId
            ? { ...g, status: "failed" as const, errorMessage: err instanceof Error ? err.message : "Network error" }
            : g
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Regenerate ───

  const handleRegenerate = (gen: GenerationItem) => {
    const model = MODELS.find((m) => m.id === gen.modelId);
    if (!model) return;

    const genMode = model.supportedModes[0];
    setMode(genMode);
    setSelectedModelId(model.id);
    setPrompt(gen.prompt);
    setDurationSec(gen.durationSec);
    setWithAudio(gen.withAudio);
  };

  // ─── Render ───

  return (
    <div className="-mx-8 -my-6 lg:-mx-12 flex h-[calc(100vh-var(--topbar-h,64px))] relative z-[45] bg-[var(--bg-deep)]">
      {/* ─── LEFT PANEL ─── */}
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-deep)]/50 p-5">
        {/* Mode Toggle */}
        <div className="mb-5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          {(["T2V", "I2V", "MOTION_TRANSFER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === tab
                  ? "bg-[var(--accent-amber)] text-[#0A0A0B]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab === "T2V" ? "Text to Video" : tab === "I2V" ? "Image to Video" : "Motion"}
            </button>
          ))}
        </div>

        {/* Model selector dropdown */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Model
        </label>
        <div ref={dropdownRef} className="relative mb-4">
          {/* Trigger button — shows selected model */}
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className={`flex w-full items-center justify-between rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              modelDropdownOpen
                ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5"
                : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {selectedModel?.name ?? "Select model"}
                </span>
                {selectedModel?.contentMode === "NSFW" && (
                  <span className="shrink-0 rounded bg-[#E8463A]/15 px-1 py-0.5 text-[8px] font-bold text-[#E8463A]">
                    NSFW
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <span>{selectedModel?.maxResolution}</span>
                <span>&middot;</span>
                <span>up to {selectedModel?.maxDuration}s</span>
                <span>&middot;</span>
                <span>{selectedModel?.tier === "ULTRA" ? "2 cr" : "1 cr"}</span>
              </div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {modelDropdownOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[320px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              {modelGroups.map((group) => (
                <div key={group.tier}>
                  <div className="sticky top-0 bg-[var(--bg-surface)] px-3 pb-1 pt-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {group.label}
                    </p>
                  </div>
                  {group.models.map((model) => {
                    const isSelected = model.id === selectedModel?.id;
                    const isNsfwModel = model.contentMode === "NSFW";
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setWithAudio(false);
                          setModelDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-150 ${
                          isSelected
                            ? "bg-[var(--accent-amber)]/5"
                            : "hover:bg-[var(--bg-elevated)]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`truncate text-xs font-medium ${isSelected ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"}`}>
                              {model.name}
                            </span>
                            {isNsfwModel && (
                              <span className="shrink-0 rounded bg-[#E8463A]/15 px-1 py-0.5 text-[8px] font-bold text-[#E8463A]">
                                NSFW
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[10px] text-[var(--text-muted)]">{model.maxResolution}</span>
                          {model.supportsAudio && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--text-muted)]">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          )}
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio toggle — shown below dropdown when model supports it */}
        {selectedModel?.supportsAudio && (
          <label className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs cursor-pointer transition-colors hover:border-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(e) => setWithAudio(e.target.checked)}
              className="h-3 w-3 accent-[var(--accent-amber)]"
            />
            <span className="text-[var(--text-secondary)]">Generate with audio</span>
          </label>
        )}

        {/* Prompt */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Prompt
        </label>
        <div className="relative mb-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isMotionMode
              ? "Describe the environment and context, not the motion (motion comes from the reference video)"
              : "Describe your scene..."
            }
            rows={5}
            maxLength={2000}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] hover:border-[var(--text-muted)]"
          />
          {submitting && (
            <div className="absolute right-2 top-2 rounded bg-[var(--accent-amber)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-amber)]">
              Generating...
            </div>
          )}
        </div>
        <p className="mb-4 text-right text-[10px] tabular-nums text-[var(--text-muted)]">
          {prompt.length}/2000
        </p>

        {/* Motion Transfer — side-by-side image + video */}
        {isMotionMode && needsImage && needsVideo && (
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Character Image */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Character Image
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Source"
                      className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] object-cover"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px]"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <UploadZone
                    onFile={handleImageFile}
                    accept="image/jpeg,image/png,image/webp"
                    className="!p-3 !min-h-[96px]"
                  />
                )}
              </div>

              {/* Reference Video */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Reference Video
                </label>
                {videoPreview ? (
                  <div className="relative">
                    <video
                      src={videoPreview}
                      className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] object-cover"
                      muted
                      playsInline
                    />
                    <button
                      onClick={clearVideo}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px]"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <UploadZone
                    onFile={handleVideoFile}
                    accept="video/mp4,video/webm"
                    className="!p-3 !min-h-[96px]"
                  />
                )}
              </div>
            </div>

            {/* Character Orientation — inline below the grid */}
            <div className="mt-3 flex gap-2">
              {(["image", "video"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setCharacterOrientation(opt)}
                  className={`flex-1 rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                    characterOrientation === opt
                      ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {opt === "image" ? "Portrait" : "Full Body"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image input (I2V only — not motion transfer, handled above) */}
        {needsImage && !isMotionMode && (
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Source Image
            </label>

            {/* Source toggle — only show if user has characters */}
            {characters.length > 0 && (
              <div className="mb-2 flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
                <button
                  onClick={() => { setImageSource("upload"); setSelectedCharacterId(null); }}
                  className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium transition-all duration-150 ${
                    imageSource === "upload"
                      ? "bg-[var(--accent-amber)] text-[#0A0A0B]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => { setImageSource("character"); clearImage(); }}
                  className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium transition-all duration-150 ${
                    imageSource === "character"
                      ? "bg-[var(--accent-amber)] text-[#0A0A0B]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Character
                </button>
              </div>
            )}

            {/* Upload mode */}
            {imageSource === "upload" && (
              <>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Source"
                      className="max-h-32 rounded-[var(--radius-md)] border border-[var(--border-default)] object-contain"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px]"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <UploadZone
                    onFile={handleImageFile}
                    accept="image/jpeg,image/png,image/webp"
                    className="!p-4"
                  />
                )}
              </>
            )}

            {/* Character picker mode */}
            {imageSource === "character" && (
              <div className="max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {characters.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                    No characters yet.{" "}
                    <a href="/characters/new" className="text-[var(--accent-amber)] underline">Create one</a>
                  </p>
                ) : (
                  <div className="p-1.5">
                    {characters.map((char) => {
                      const isSelected = selectedCharacterId === char.id;
                      return (
                        <button
                          key={char.id}
                          onClick={() => setSelectedCharacterId(isSelected ? null : char.id)}
                          className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-all duration-150 ${
                            isSelected
                              ? "bg-[var(--accent-amber)]/10 ring-1 ring-[var(--accent-amber)]/40"
                              : "hover:bg-[var(--bg-elevated)]"
                          }`}
                        >
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-input)]">
                            {char.thumbnailUrl ? (
                              <img
                                src={char.thumbnailUrl}
                                alt={char.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                                {char.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-xs font-medium ${isSelected ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"}`}>
                              {char.name}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)]">{char.style}</p>
                          </div>
                          {isSelected && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-amber)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Video upload (non-motion — shouldn't normally appear but kept for safety) */}
        {needsVideo && !isMotionMode && (
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Reference Video
            </label>
            {videoPreview ? (
              <div className="relative inline-block">
                <video
                  src={videoPreview}
                  className="max-h-32 rounded-[var(--radius-md)] border border-[var(--border-default)] object-contain"
                  muted
                  playsInline
                />
                <button
                  onClick={clearVideo}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px]"
                >
                  X
                </button>
              </div>
            ) : (
              <UploadZone
                onFile={handleVideoFile}
                accept="video/mp4,video/webm"
                className="!p-4"
              />
            )}
          </div>
        )}

        {/* Duration pills */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Duration
        </label>
        <div className="mb-4 flex flex-wrap gap-2">
          {availableDurations.map((d) => (
            <button
              key={d}
              onClick={() => setDurationSec(d)}
              className={`min-w-[40px] rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                durationSec === d
                  ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>

        {/* Credit cost summary */}
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Cost</span>
            <span className="text-base font-bold tabular-nums text-[var(--accent-amber)]">
              {creditCost} cr
            </span>
          </div>
          {durationMultiplier > 1 && (
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              {selectedModel?.creditCost} base &times; {durationMultiplier} ({durationSec}s)
            </p>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[11px]">
            <span className="text-[var(--text-muted)]">Balance</span>
            <span className={`font-medium tabular-nums ${canAfford ? "text-[var(--text-secondary)]" : "text-[var(--error)]"}`}>
              {credits.toLocaleString()} credits
            </span>
          </div>
          {!canAfford && (
            <p className="mt-1.5 text-[11px] text-[var(--error)]">
              Not enough credits.{" "}
              <a href="/pricing" className="underline">Buy credits</a>
            </p>
          )}
        </div>

        {/* Generate button */}
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          disabled={
            submitting ||
            !canAfford ||
            !prompt.trim() ||
            inFlightCount >= MAX_CONCURRENT ||
            (needsImage && imageSource === "upload" && !imageFile) ||
            (needsImage && imageSource === "character" && !selectedCharacterId) ||
            (needsVideo && !videoFile)
          }
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
              </svg>
              Submitting...
            </span>
          ) : inFlightCount >= MAX_CONCURRENT ? (
            `${MAX_CONCURRENT} in progress — wait`
          ) : (
            `Generate — ${creditCost} cr`
          )}
        </Button>

        {inFlightCount >= MAX_CONCURRENT && (
          <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
            {MAX_CONCURRENT} generations in progress — wait for one to complete
          </p>
        )}
      </div>

      {/* ─── CENTER PANEL (Feed) ─── */}
      <div className="flex-1 overflow-y-auto p-6">
        {generations.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-default)] px-12 py-16 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-[var(--text-muted)]">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="m10 8 5 3-5 3z" />
                <line x1="2" y1="21" x2="22" y2="21" />
                <line x1="7" y1="17" x2="7" y2="21" />
                <line x1="17" y1="17" x2="17" y2="21" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Your generations will appear here
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Configure your settings and click Generate
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {generations.map((gen) => (
              <GenerationCard
                key={gen.id}
                gen={gen}
                isSelected={gen.id === selectedId}
                onSelect={() => setSelectedId(gen.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── RIGHT PANEL (Details) ─── */}
      <div className="w-[300px] shrink-0 overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg-deep)]/50 p-5">
        {selectedGeneration ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Details
              </h3>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  selectedGeneration.status === "completed" ? "bg-[var(--success)]" :
                  selectedGeneration.status === "failed" ? "bg-[var(--error)]" :
                  "animate-pulse bg-[var(--accent-amber)]"
                }`}
              />
              <span className="text-sm font-medium capitalize text-[var(--text-primary)]">
                {selectedGeneration.status}
              </span>
              {(selectedGeneration.status === "queued" || selectedGeneration.status === "processing" || selectedGeneration.status === "submitting") && (
                <span className="ml-auto text-xs tabular-nums text-[var(--text-muted)]">
                  {formatElapsed(selectedGeneration.elapsedSec)}
                </span>
              )}
            </div>

            {/* Progress */}
            {(selectedGeneration.status === "queued" || selectedGeneration.status === "processing") && (
              <div>
                <ProgressBar
                  progress={selectedGeneration.progress}
                  animated={selectedGeneration.status === "processing"}
                />
                <p className="mt-1 text-center text-[10px] tabular-nums text-[var(--text-muted)]">
                  {selectedGeneration.progress}%
                </p>
              </div>
            )}

            {/* Error */}
            {selectedGeneration.status === "failed" && selectedGeneration.errorMessage && (
              <div className="rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2.5">
                <p className="text-xs text-[var(--error)]">{selectedGeneration.errorMessage}</p>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Prompt
              </label>
              <p className="max-h-32 overflow-y-auto text-xs leading-relaxed text-[var(--text-secondary)]">
                {selectedGeneration.prompt}
              </p>
            </div>

            {/* Metadata */}
            <div className="space-y-2">
              <MetaRow label="Model" value={selectedGeneration.modelName} />
              <MetaRow label="Duration" value={`${selectedGeneration.durationSec}s`} />
              <MetaRow label="Audio" value={selectedGeneration.withAudio ? "Yes" : "No"} />
              <MetaRow label="Credits" value={`${selectedGeneration.creditCost}`} />
              <MetaRow label="Created" value={new Date(selectedGeneration.createdAt).toLocaleTimeString()} />
              {selectedGeneration.generationTimeMs && (
                <MetaRow label="Gen time" value={`${(selectedGeneration.generationTimeMs / 1000).toFixed(1)}s`} />
              )}
            </div>

            {/* Post-process chain link */}
            {selectedGeneration.parentGenerationId && (
              <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">Enhanced from</p>
                <button
                  onClick={() => {
                    const parent = generations.find(
                      (g) => g.generationId === selectedGeneration.parentGenerationId
                    );
                    if (parent) setSelectedId(parent.id);
                  }}
                  className="text-xs font-medium text-[var(--accent-amber)] hover:underline"
                >
                  Parent generation
                </button>
                {selectedGeneration.postProcessType && (
                  <Badge variant="default" className="ml-2 !text-[9px]">
                    {selectedGeneration.postProcessType.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {selectedGeneration.status === "completed" && selectedGeneration.outputUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = selectedGeneration.outputUrl!;
                    a.download = `artifacial-${selectedGeneration.generationId}.mp4`;
                    a.click();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => handleRegenerate(selectedGeneration)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Regenerate
              </Button>

              {/* Post-Processing Buttons */}
              {selectedGeneration.status === "completed" && selectedGeneration.generationId && (
                <PostProcessActions
                  generation={selectedGeneration}
                  credits={credits}
                  characters={characters}
                  onPostProcess={(newGen) => {
                    setGenerations((prev) => [newGen, ...prev]);
                    setSelectedId(newGen.id);
                    setCredits((c) => c - newGen.creditCost);
                    startPollingFor(newGen.id, newGen.generationId!);
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-[var(--text-muted)]">
              Select a generation<br />to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generation Card (center feed) ───

function GenerationCard({
  gen,
  isSelected,
  onSelect,
}: {
  gen: GenerationItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || gen.status !== "completed") return;

    if (isHovered) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, gen.status]);

  const isInFlight = gen.status === "submitting" || gen.status === "queued" || gen.status === "processing";

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="block w-full text-left"
    >
      <Card
        className={`overflow-hidden transition-all duration-200 ${
          isSelected
            ? "ring-1 ring-[var(--accent-amber)] shadow-[0_0_20px_rgba(232,166,52,0.1)]"
            : "hover:border-[var(--text-muted)]"
        }`}
      >
        <div className="relative aspect-video bg-[var(--bg-elevated)]">
          {gen.status === "completed" && gen.outputUrl ? (
            <video
              ref={videoRef}
              src={gen.outputUrl}
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : gen.status === "failed" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--error)]/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className="text-xs text-[var(--error)]">Failed</p>
              {gen.errorMessage && (
                <p className="max-w-[200px] truncate text-[10px] text-[var(--text-muted)]">{gen.errorMessage}</p>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="relative h-10 w-10">
                <svg className="h-10 w-10 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="var(--border-default)" strokeWidth="2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium capitalize text-[var(--text-secondary)]">
                  {gen.status === "submitting" ? "Submitting..." : gen.status}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                  {formatElapsed(gen.elapsedSec)}
                </p>
              </div>
              {isInFlight && gen.progress > 0 && (
                <div className="w-32">
                  <ProgressBar progress={gen.progress} animated />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <Badge variant={gen.status === "completed" ? "success" : gen.status === "failed" ? "error" : "amber"}>
            {gen.modelName}
          </Badge>
          <span className="text-[10px] text-[var(--text-muted)]">{gen.durationSec}s</span>
          {gen.withAudio && (
            <span className="text-[10px] text-[var(--accent-amber)]">audio</span>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-[var(--text-muted)]">
            {gen.status === "completed" && gen.generationTimeMs
              ? `${(gen.generationTimeMs / 1000).toFixed(0)}s`
              : isInFlight
                ? formatElapsed(gen.elapsedSec)
                : ""}
          </span>
        </div>
      </Card>
    </button>
  );
}

// ─── Detail Metadata Row ───

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

// ─── Post-Processing Actions ───

const POST_PROCESS_COSTS = {
  UPSCALE: 1,
  FACE_SWAP: 1,
  LIP_SYNC: 1,
  STYLE_TRANSFER: 1,
} as const;

function PostProcessActions({
  generation,
  credits,
  characters,
  onPostProcess,
}: {
  generation: GenerationItem;
  credits: number;
  characters: CharacterOption[];
  onPostProcess: (gen: GenerationItem) => void;
}) {
  const [activeModal, setActiveModal] = useState<"FACE_SWAP" | "LIP_SYNC" | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [faceMode, setFaceMode] = useState<"character" | "upload">(characters.length > 0 ? "character" : "upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitPostProcess = async (
    type: string,
    extraBody: Record<string, unknown> = {}
  ) => {
    if (submitting || !generation.generationId) return;
    setSubmitting(true);

    const itemId = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const body: Record<string, unknown> = { type, ...extraBody };

      const res = await fetch(`/api/generate/${generation.generationId}/postprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Post-processing failed");
        return;
      }

      const newGen: GenerationItem = {
        id: itemId,
        generationId: data.generationId,
        status: "queued",
        progress: 0,
        modelId: `comfyui-${type.toLowerCase().replace(/_/g, "-")}`,
        modelName: type.replace(/_/g, " "),
        prompt: type === "STYLE_TRANSFER" ? (extraBody.stylePrompt as string) || "" : generation.prompt,
        durationSec: generation.durationSec,
        withAudio: false,
        creditCost: POST_PROCESS_COSTS[type as keyof typeof POST_PROCESS_COSTS] ?? 1,
        createdAt: Date.now(),
        elapsedSec: 0,
        parentGenerationId: generation.generationId!,
        postProcessType: type,
        resolution: type === "UPSCALE" ? "1080p" : generation.resolution,
      };

      onPostProcess(newGen);
      setActiveModal(null);
      setFaceFile(null);
      setSelectedCharacterId(null);
      setAudioFile(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFaceSwap = async () => {
    if (faceMode === "character" && selectedCharacterId) {
      await submitPostProcess("FACE_SWAP", { characterId: selectedCharacterId });
    } else if (faceMode === "upload" && faceFile) {
      const base64 = await fileToDataUrl(faceFile);
      await submitPostProcess("FACE_SWAP", { faceImage: base64 });
    }
  };

  const handleLipSync = async () => {
    if (!audioFile) return;
    const base64 = await fileToDataUrl(audioFile);
    await submitPostProcess("LIP_SYNC", { audioFile: base64 });
  };

  const is720p = generation.resolution === "720p" || !generation.resolution;

  return (
    <>
      <div className="border-t border-[var(--border-subtle)] pt-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Enhance
        </p>
      </div>

      {is720p && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={credits < POST_PROCESS_COSTS.UPSCALE}
          onClick={() => submitPostProcess("UPSCALE", { targetResolution: "1080p" })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          Upscale to 1080p
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.UPSCALE}cr</span>
        </Button>
      )}

      <Button variant="secondary" size="sm" fullWidth disabled={credits < POST_PROCESS_COSTS.FACE_SWAP} onClick={() => setActiveModal("FACE_SWAP")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
        Face swap
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.FACE_SWAP}cr</span>
      </Button>

      <Button variant="secondary" size="sm" fullWidth disabled={credits < POST_PROCESS_COSTS.LIP_SYNC} onClick={() => setActiveModal("LIP_SYNC")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        Lip sync
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.LIP_SYNC}cr</span>
      </Button>

      <Button variant="ghost" size="sm" fullWidth disabled className="opacity-40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        Style transfer — Coming soon
      </Button>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeModal === "FACE_SWAP" && "Face Swap"}
                {activeModal === "LIP_SYNC" && "Lip Sync"}
              </h3>
              <button
                onClick={() => { setActiveModal(null); setFaceFile(null); setSelectedCharacterId(null); setAudioFile(null); }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {activeModal === "FACE_SWAP" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">Select a character or upload a face image.</p>

                {characters.length > 0 && (
                  <div className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
                    <button
                      onClick={() => { setFaceMode("character"); setFaceFile(null); }}
                      className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium transition-colors ${
                        faceMode === "character" ? "bg-[var(--accent-amber)] text-[#0A0A0B]" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      My Characters
                    </button>
                    <button
                      onClick={() => { setFaceMode("upload"); setSelectedCharacterId(null); }}
                      className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium transition-colors ${
                        faceMode === "upload" ? "bg-[var(--accent-amber)] text-[#0A0A0B]" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      Upload
                    </button>
                  </div>
                )}

                {faceMode === "character" && characters.length > 0 ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {characters.filter((c) => c.thumbnailUrl).map((char) => (
                      <button
                        key={char.id}
                        onClick={() => setSelectedCharacterId(char.id)}
                        className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 text-left transition-colors ${
                          selectedCharacterId === char.id
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5"
                            : "border-[var(--border-subtle)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                          {char.thumbnailUrl && <img src={char.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <span className="truncate text-xs text-[var(--text-primary)]">{char.name}</span>
                        {selectedCharacterId === char.id && (
                          <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-amber)]" />
                        )}
                      </button>
                    ))}
                    {characters.filter((c) => c.thumbnailUrl).length === 0 && (
                      <p className="py-2 text-center text-[10px] text-[var(--text-muted)]">No characters with face images yet</p>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFaceFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text-primary)]"
                    />
                    {faceFile && <p className="text-[10px] text-[var(--text-muted)]">{faceFile.name}</p>}
                  </>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={submitting || (faceMode === "character" ? !selectedCharacterId : !faceFile)}
                  onClick={handleFaceSwap}
                >
                  {submitting ? "Submitting..." : `Face Swap — ${POST_PROCESS_COSTS.FACE_SWAP}cr`}
                </Button>
              </div>
            )}

            {activeModal === "LIP_SYNC" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">Upload an audio file to sync with the video.</p>
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp3"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text-primary)]"
                />
                {audioFile && <p className="text-[10px] text-[var(--text-muted)]">{audioFile.name}</p>}
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={!audioFile || submitting}
                  onClick={handleLipSync}
                >
                  {submitting ? "Submitting..." : `Lip Sync — ${POST_PROCESS_COSTS.LIP_SYNC}cr`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helpers ───

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
