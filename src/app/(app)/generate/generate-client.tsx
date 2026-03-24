"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { UploadZone } from "@/components/upload-zone";

// ─── Client-side model data (mirrors registry.ts for use in the browser) ───

type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
type ModelMode = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";
type ModelContentMode = "SFW" | "NSFW" | "BOTH";

type ClientModel = {
  id: string;
  name: string;
  provider: "PIAPI";
  tier: ModelTier;
  creditCost: number;
  supportedModes: ModelMode[];
  maxDuration: number;
  maxResolution: string;
  supportsAudio: boolean;
  contentMode: ModelContentMode;
  description: string;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  supportsEndFrame: boolean;
};

const MODELS: ClientModel[] = [
  // ── SFW Budget ──
  { id: "wan-22", name: "Wan 2.2", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Economy option. Fast generation.", durations: [5], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "wan-26", name: "Wan 2.6", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Budget option. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "framepack", name: "Framepack", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["I2V"], maxDuration: 30, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Long-form I2V. Up to 30 seconds.", durations: [10, 15, 20, 30], aspectRatios: [], resolutions: [], supportsEndFrame: true },
  // ── SFW Standard ──
  { id: "kling-26-std", name: "Kling 2.6 Standard", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "720p", supportsAudio: true, contentMode: "SFW", description: "Reliable standard quality. Native audio.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: true },
  { id: "seedance-2", name: "Seedance 2", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 15, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "ByteDance's latest. Up to 15 seconds.", durations: [5, 10, 15], aspectRatios: ["16:9", "9:16", "4:3", "3:4"], resolutions: [], supportsEndFrame: false },
  { id: "sora-2", name: "Sora 2", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V", "I2V"], maxDuration: 12, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "OpenAI's video model. Up to 12 seconds.", durations: [4, 8, 12], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  // ── SFW Ultra ──
  { id: "kling-26-pro", name: "Kling 2.6 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Premium Kling quality with audio.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: true },
  { id: "kling-30-pro", name: "Kling 3.0 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 15, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Best overall quality. Up to 15 seconds with audio.", durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: true },
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 12, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "OpenAI's flagship. 1080p up to 12 seconds.", durations: [4, 8, 12], aspectRatios: ["16:9", "9:16"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "veo-31", name: "Veo 3.1", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 8, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Google's best. Cinematic quality with audio.", durations: [4, 6, 8], aspectRatios: ["16:9", "9:16"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "seedance-2-pro", name: "Seedance 2 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["T2V", "I2V"], maxDuration: 15, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "ByteDance premium. Higher quality.", durations: [5, 10, 15], aspectRatios: ["16:9", "9:16", "4:3", "3:4"], resolutions: [], supportsEndFrame: false },
  // ── Motion Control ──
  { id: "kling-26-motion-std", name: "Kling 2.6 Motion (Standard)", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["MOTION_TRANSFER"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Copy motion from reference video. Standard quality.", durations: [5, 10], aspectRatios: [], resolutions: [], supportsEndFrame: false },
  { id: "kling-26-motion-pro", name: "Kling 2.6 Motion (Pro)", provider: "PIAPI", tier: "ULTRA", creditCost: 2, supportedModes: ["MOTION_TRANSFER"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Copy motion from reference video. Pro quality.", durations: [5, 10], aspectRatios: [], resolutions: [], supportsEndFrame: false },
  // ── NSFW Budget ──
  { id: "wan22-nsfw-t2v", name: "Wan 2.2 NSFW", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["T2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Budget NSFW option. Fast 720p generation.", durations: [5], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "wan22-nsfw-i2v", name: "Wan 2.2 NSFW", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Budget NSFW image-to-video.", durations: [5], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  // ── NSFW Standard ──
  { id: "wan26-nsfw-t2v", name: "Wan 2.6 NSFW", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted text-to-video. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "wan26-nsfw-i2v", name: "Wan 2.6 NSFW", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted image-to-video. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  // ── Image — Budget ──
  { id: "z-image-turbo", name: "Z-Image Turbo", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["T2I"], maxDuration: 0, maxResolution: "1440px", supportsAudio: false, contentMode: "BOTH", description: "Fast photorealistic images. Sub-second.", durations: [], aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "flux-schnell", name: "Flux Schnell", provider: "PIAPI", tier: "BUDGET", creditCost: 1, supportedModes: ["T2I"], maxDuration: 0, maxResolution: "1024px", supportsAudio: false, contentMode: "SFW", description: "Fast Flux generation. Good for iterations.", durations: [], aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  // ── Image — Standard ──
  { id: "qwen-image", name: "Qwen Image", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2I"], maxDuration: 0, maxResolution: "1024px", supportsAudio: false, contentMode: "SFW", description: "Alibaba's latest image model.", durations: [], aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "seedream-5", name: "Seedream 5", provider: "PIAPI", tier: "STANDARD", creditCost: 1, supportedModes: ["T2I"], maxDuration: 0, maxResolution: "3K", supportsAudio: false, contentMode: "SFW", description: "ByteDance image model. Up to 3K resolution.", durations: [], aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], resolutions: [], supportsEndFrame: false },
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

type ModeTab = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";

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
  const [selectedModelId, setSelectedModelId] = useState<string>(isNsfw ? "wan26-nsfw-t2v" : "kling-30-pro");
  const isImageMode = mode === "T2I";
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("image");

  // Popup state for duration/aspect/quality pickers
  const [durationPopupOpen, setDurationPopupOpen] = useState(false);
  const [aspectPopupOpen, setAspectPopupOpen] = useState(false);
  const [qualityPopupOpen, setQualityPopupOpen] = useState(false);
  const durationPopupRef = useRef<HTMLDivElement>(null);
  const aspectPopupRef = useRef<HTMLDivElement>(null);
  const qualityPopupRef = useRef<HTMLDivElement>(null);

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

  // Credit cost: base * duration multiplier (images = flat cost)
  const durationMultiplier = isImageMode ? 1 : Math.ceil(durationSec / 5);
  const creditCost = selectedModel ? selectedModel.creditCost * durationMultiplier : 1;
  const canAfford = credits >= creditCost;

  // Available options based on model capabilities
  const availableDurations = selectedModel?.durations ?? [5];
  const availableAspectRatios = selectedModel?.aspectRatios ?? [];
  const availableResolutions = selectedModel?.resolutions ?? [];
  const modelSupportsEndFrame = selectedModel?.supportsEndFrame ?? false;

  const isMotionMode = mode === "MOTION_TRANSFER";
  const needsImage = isMotionMode || (selectedModel && mode === "I2V");
  const needsVideo = isMotionMode;
  const showDuration = !isImageMode;
  const showAspectRatio = availableAspectRatios.length > 0;

  const inFlightCount = generations.filter(
    (g) => g.status === "submitting" || g.status === "queued" || g.status === "processing"
  ).length;

  const selectedGeneration = generations.find((g) => g.id === selectedId) ?? null;

  // When mode changes, select the best default model for that mode
  useEffect(() => {
    const defaults: Record<string, Record<ModeTab, string>> = {
      SFW: { T2V: "kling-30-pro", I2V: "kling-30-pro", T2I: "z-image-turbo", MOTION_TRANSFER: "kling-26-motion-std" },
      NSFW: { T2V: "wan26-nsfw-t2v", I2V: "wan26-nsfw-i2v", T2I: "z-image-turbo", MOTION_TRANSFER: "kling-26-motion-std" },
    };
    const defaultId = defaults[userContentMode]?.[mode];
    const target = filteredModels.find((m) => m.id === defaultId) ?? filteredModels[0];
    if (target) {
      setSelectedModelId(target.id);
      setWithAudio(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // When model changes, clamp duration, aspect ratio, resolution
  useEffect(() => {
    if (!selectedModel) return;
    // Clamp duration to model's allowed values
    if (!selectedModel.durations.includes(durationSec)) {
      const closest = selectedModel.durations.find(d => d >= durationSec) ?? selectedModel.durations[selectedModel.durations.length - 1] ?? 5;
      setDurationSec(closest);
    }
    // Clamp aspect ratio
    if (selectedModel.aspectRatios.length > 0 && !selectedModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(selectedModel.aspectRatios.includes("16:9") ? "16:9" : selectedModel.aspectRatios[0]);
    }
    // Clamp resolution
    if (selectedModel.resolutions.length > 0 && !selectedModel.resolutions.includes(resolution)) {
      setResolution(selectedModel.resolutions.includes("720p") ? "720p" : selectedModel.resolutions[0]);
    }
    if (!selectedModel.supportsAudio) setWithAudio(false);
    // Clear end frame if model doesn't support it
    if (!selectedModel.supportsEndFrame && endImageFile) {
      if (endImagePreview) URL.revokeObjectURL(endImagePreview);
      setEndImageFile(null);
      setEndImagePreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // Close dropdowns on click outside
  useEffect(() => {
    const anyOpen = modelDropdownOpen || durationPopupOpen || aspectPopupOpen || qualityPopupOpen;
    if (!anyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modelDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
      if (durationPopupOpen && durationPopupRef.current && !durationPopupRef.current.contains(e.target as Node)) setDurationPopupOpen(false);
      if (aspectPopupOpen && aspectPopupRef.current && !aspectPopupRef.current.contains(e.target as Node)) setAspectPopupOpen(false);
      if (qualityPopupOpen && qualityPopupRef.current && !qualityPopupRef.current.contains(e.target as Node)) setQualityPopupOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelDropdownOpen, durationPopupOpen, aspectPopupOpen, qualityPopupOpen]);

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

  // Handle end frame file
  const handleEndImageFile = useCallback((file: File) => {
    setEndImageFile(file);
    setEndImagePreview(URL.createObjectURL(file));
  }, []);

  const clearEndImage = useCallback(() => {
    if (endImagePreview) URL.revokeObjectURL(endImagePreview);
    setEndImageFile(null);
    setEndImagePreview(null);
  }, [endImagePreview]);

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

      let endImageUrl: string | undefined;
      if (mode === "I2V" && modelSupportsEndFrame && endImageFile) {
        endImageUrl = await fileToDataUrl(endImageFile);
      }

      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        modelId: selectedModel.id,
        durationSec: isImageMode ? 1 : durationSec,
        withAudio: !isImageMode && withAudio && selectedModel.supportsAudio,
      };
      if (imageUrl) body.imageUrl = imageUrl;
      if (endImageUrl) body.endImageUrl = endImageUrl;
      if (videoUrl) body.videoUrl = videoUrl;
      if (showAspectRatio) body.aspectRatio = aspectRatio;
      if (availableResolutions.length > 0) body.resolution = resolution;
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
          {(["T2V", "I2V", "T2I", "MOTION_TRANSFER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === tab
                  ? "bg-[var(--accent-amber)] text-[#0A0A0B]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab === "T2V" ? "Text → Video" : tab === "I2V" ? "Image → Video" : tab === "T2I" ? "Text → Image" : "Motion"}
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
                {!isImageMode && selectedModel?.maxDuration && (
                  <>
                    <span>&middot;</span>
                    <span>up to {selectedModel?.maxDuration}s</span>
                  </>
                )}
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
            ref={(el) => {
              if (!el) return;
              el.style.height = "auto";
              // Base height ~120px (5 rows), max ~160px (+1/3)
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isMotionMode
              ? "Describe the environment and context, not the motion (motion comes from the reference video)"
              : "Describe your scene..."
            }
            rows={5}
            maxLength={2000}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] hover:border-[var(--text-muted)]"
            style={{ minHeight: "120px", maxHeight: "160px", overflow: "auto" }}
          />
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
              <div className={modelSupportsEndFrame ? "grid grid-cols-2 gap-3" : ""}>
                {/* Start frame */}
                <div>
                  {modelSupportsEndFrame && (
                    <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">Start frame</p>
                  )}
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
                </div>

                {/* End frame — only for models that support it */}
                {modelSupportsEndFrame && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">End frame <span className="text-[var(--text-muted)]/60">(optional)</span></p>
                    {endImagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={endImagePreview}
                          alt="End frame"
                          className="max-h-32 rounded-[var(--radius-md)] border border-[var(--border-default)] object-contain"
                        />
                        <button
                          onClick={clearEndImage}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white text-[10px]"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <UploadZone
                        onFile={handleEndImageFile}
                        accept="image/jpeg,image/png,image/webp"
                        className="!p-4"
                      />
                    )}
                  </div>
                )}
              </div>
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

        {/* ── Settings Row: Duration, Aspect Ratio, Quality ── */}
        <div className="mb-4 flex flex-wrap gap-2">
          {/* Duration button + popup (hidden for image models) */}
          {showDuration && availableDurations.length > 0 && (
            <div ref={durationPopupRef} className="relative">
              <button
                type="button"
                onClick={() => { setDurationPopupOpen(!durationPopupOpen); setAspectPopupOpen(false); setQualityPopupOpen(false); }}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {durationSec}s
              </button>
              {durationPopupOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Duration</p>
                  {availableDurations.length > 3 ? (
                    <>
                      <input
                        type="range"
                        min={availableDurations[0]}
                        max={availableDurations[availableDurations.length - 1]}
                        step={1}
                        value={durationSec}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          // Snap to nearest allowed value
                          const closest = availableDurations.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
                          setDurationSec(closest);
                        }}
                        className="w-full accent-[var(--accent-amber)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
                        <span>{availableDurations[0]}s</span>
                        <span className="font-medium text-[var(--accent-amber)]">{durationSec}s</span>
                        <span>{availableDurations[availableDurations.length - 1]}s</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-1.5">
                      {availableDurations.map((d) => (
                        <button
                          key={d}
                          onClick={() => { setDurationSec(d); setDurationPopupOpen(false); }}
                          className={`flex-1 rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                            durationSec === d
                              ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                              : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                          }`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aspect ratio button + popup */}
          {availableAspectRatios.length > 0 && (
            <div ref={aspectPopupRef} className="relative">
              <button
                type="button"
                onClick={() => { setAspectPopupOpen(!aspectPopupOpen); setDurationPopupOpen(false); setQualityPopupOpen(false); }}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]"><rect x="2" y="3" width="20" height="18" rx="2"/></svg>
                {aspectRatio}
              </button>
              {aspectPopupOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aspect Ratio</p>
                  <div className="flex flex-wrap gap-1">
                    {availableAspectRatios.map((ar) => (
                      <button
                        key={ar}
                        onClick={() => { setAspectRatio(ar); setAspectPopupOpen(false); }}
                        className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                          aspectRatio === ar
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quality/Resolution button + popup */}
          {availableResolutions.length > 0 && (
            <div ref={qualityPopupRef} className="relative">
              <button
                type="button"
                onClick={() => { setQualityPopupOpen(!qualityPopupOpen); setDurationPopupOpen(false); setAspectPopupOpen(false); }}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                {resolution}
              </button>
              {qualityPopupOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[120px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quality</p>
                  <div className="flex flex-col gap-1">
                    {availableResolutions.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setResolution(r); setQualityPopupOpen(false); }}
                        className={`rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all duration-150 ${
                          resolution === r
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

      {/* ─── CENTER PANEL ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
          <>
            {/* ── Main Preview ── */}
            <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
              {selectedGeneration ? (
                <div className="relative flex h-full w-full max-w-5xl items-center justify-center">
                  {selectedGeneration.status === "completed" && selectedGeneration.outputUrl ? (
                    <div className="relative max-h-full max-w-full">
                      {selectedGeneration.outputUrl.match(/\.(png|jpg|jpeg|webp)($|\?)/) || selectedGeneration.durationSec === 0 ? (
                        <img
                          key={selectedGeneration.outputUrl}
                          src={selectedGeneration.outputUrl}
                          alt={selectedGeneration.prompt}
                          className="max-h-[calc(100vh-var(--topbar-h,64px)-120px)] w-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_0_40px_rgba(0,0,0,0.4)]"
                        />
                      ) : (
                        <video
                          key={selectedGeneration.outputUrl}
                          src={selectedGeneration.outputUrl}
                          controls
                          autoPlay
                          loop
                          playsInline
                          className="max-h-[calc(100vh-var(--topbar-h,64px)-120px)] w-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_0_40px_rgba(0,0,0,0.4)]"
                        />
                      )}
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <Badge variant="default" className="!bg-black/70 !text-[10px] backdrop-blur-sm">{selectedGeneration.modelName}</Badge>
                        {selectedGeneration.durationSec > 0 && (
                          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-[var(--text-muted)] backdrop-blur-sm">{selectedGeneration.durationSec}s</span>
                        )}
                        {selectedGeneration.generationTimeMs && (
                          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-[var(--text-muted)] backdrop-blur-sm">{(selectedGeneration.generationTimeMs / 1000).toFixed(0)}s gen</span>
                        )}
                      </div>
                    </div>
                  ) : selectedGeneration.status === "failed" ? (
                    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-12 py-16">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--error)]/10">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-[var(--error)]">Generation Failed</p>
                      {selectedGeneration.errorMessage && (
                        <p className="max-w-sm text-center text-xs text-[var(--text-muted)]">{selectedGeneration.errorMessage}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative h-12 w-12">
                        <svg className="h-12 w-12 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="var(--border-default)" strokeWidth="2" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium capitalize text-[var(--text-secondary)]">
                          {selectedGeneration.status === "submitting" ? "Submitting..." : selectedGeneration.status}
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-[var(--text-muted)]">
                          {formatElapsed(selectedGeneration.elapsedSec)}
                        </p>
                      </div>
                      {selectedGeneration.progress > 0 && (
                        <div className="w-48">
                          <ProgressBar progress={selectedGeneration.progress} animated />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Select a generation to preview</p>
              )}
            </div>

            {/* ── Thumbnail Strip ── */}
            {generations.length > 1 && (
              <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-deep)]/80 px-4 py-3">
                <div className="flex gap-2 overflow-x-auto">
                  {generations.map((gen) => (
                    <button
                      key={gen.id}
                      onClick={() => setSelectedId(gen.id)}
                      className={`group relative h-16 w-28 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150 ${
                        gen.id === selectedId
                          ? "border-[var(--accent-amber)] shadow-[0_0_12px_rgba(232,166,52,0.15)]"
                          : "border-transparent opacity-60 hover:opacity-90"
                      }`}
                    >
                      {gen.status === "completed" && gen.outputUrl ? (
                        gen.outputUrl.match(/\.(png|jpg|jpeg|webp)($|\?)/) || gen.durationSec === 0 ? (
                          <img src={gen.outputUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <video src={gen.outputUrl} muted preload="metadata" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-[10px] font-medium ${
                          gen.status === "failed" ? "bg-[var(--error)]/10 text-[var(--error)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        }`}>
                          {gen.status === "failed" ? "Failed" : gen.status === "completed" ? "Done" : "..."}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3">
                        <p className="truncate text-[9px] font-medium text-white/90">{gen.modelName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
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
              {selectedGeneration.durationSec > 0 && (
                <MetaRow label="Duration" value={`${selectedGeneration.durationSec}s`} />
              )}
              {selectedGeneration.durationSec > 0 && (
                <MetaRow label="Audio" value={selectedGeneration.withAudio ? "Yes" : "No"} />
              )}
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
                    const ext = isImageMode || selectedGeneration.outputUrl?.match(/\.(png|jpg|jpeg|webp)/) ? "webp" : "mp4";
                    a.download = `artifacial-${selectedGeneration.generationId}.${ext}`;
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
  FACE_SWAP: 1,
  VIDEO_FACE_SWAP: 2,
  BACKGROUND_REMOVAL: 1,
  VIRTUAL_TRY_ON: 1,
  AI_HUG: 1,
} as const;

type PostProcessModalType = "FACE_SWAP" | "VIRTUAL_TRY_ON" | null;

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
  const [activeModal, setActiveModal] = useState<PostProcessModalType>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [faceMode, setFaceMode] = useState<"character" | "upload">(characters.length > 0 ? "character" : "upload");
  const [dressFile, setDressFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isVideoSource = generation.durationSec > 0;
  const isImageSource = !isVideoSource;

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
        modelId: `piapi-${type.toLowerCase().replace(/_/g, "-")}`,
        modelName: type.replace(/_/g, " "),
        prompt: generation.prompt,
        durationSec: type === "AI_HUG" ? 5 : (isImageSource ? 0 : generation.durationSec),
        withAudio: false,
        creditCost: POST_PROCESS_COSTS[type as keyof typeof POST_PROCESS_COSTS] ?? 1,
        createdAt: Date.now(),
        elapsedSec: 0,
        parentGenerationId: generation.generationId!,
        postProcessType: type,
        resolution: generation.resolution,
      };

      onPostProcess(newGen);
      setActiveModal(null);
      setFaceFile(null);
      setSelectedCharacterId(null);
      setDressFile(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFaceSwap = async () => {
    const type = isVideoSource ? "VIDEO_FACE_SWAP" : "FACE_SWAP";
    if (faceMode === "character" && selectedCharacterId) {
      await submitPostProcess(type, { characterId: selectedCharacterId });
    } else if (faceMode === "upload" && faceFile) {
      const base64 = await fileToDataUrl(faceFile);
      await submitPostProcess(type, { faceImage: base64 });
    }
  };

  const handleVirtualTryOn = async () => {
    if (!dressFile) return;
    const base64 = await fileToDataUrl(dressFile);
    await submitPostProcess("VIRTUAL_TRY_ON", { dressImageUrl: base64 });
  };

  const faceSwapCost = isVideoSource ? POST_PROCESS_COSTS.VIDEO_FACE_SWAP : POST_PROCESS_COSTS.FACE_SWAP;

  return (
    <>
      <div className="border-t border-[var(--border-subtle)] pt-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Enhance
        </p>
      </div>

      {/* Face Swap — works on both images and videos */}
      <Button variant="secondary" size="sm" fullWidth disabled={credits < faceSwapCost} onClick={() => setActiveModal("FACE_SWAP")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
        Face swap{isVideoSource ? " (video)" : ""}
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{faceSwapCost}cr</span>
      </Button>

      {/* Background Removal — images only */}
      {isImageSource && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={credits < POST_PROCESS_COSTS.BACKGROUND_REMOVAL}
          onClick={() => submitPostProcess("BACKGROUND_REMOVAL")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
          </svg>
          Remove background
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.BACKGROUND_REMOVAL}cr</span>
        </Button>
      )}

      {/* Virtual Try-On — images only */}
      {isImageSource && (
        <Button variant="secondary" size="sm" fullWidth disabled={credits < POST_PROCESS_COSTS.VIRTUAL_TRY_ON} onClick={() => setActiveModal("VIRTUAL_TRY_ON")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M6.5 6.5 17.5 17.5M6.5 17.5 17.5 6.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
          </svg>
          Virtual try-on
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.VIRTUAL_TRY_ON}cr</span>
        </Button>
      )}

      {/* AI Hug — images only, produces video */}
      {isImageSource && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={credits < POST_PROCESS_COSTS.AI_HUG}
          onClick={() => submitPostProcess("AI_HUG")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          AI Hug
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{POST_PROCESS_COSTS.AI_HUG}cr</span>
        </Button>
      )}

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeModal === "FACE_SWAP" && (isVideoSource ? "Video Face Swap" : "Face Swap")}
                {activeModal === "VIRTUAL_TRY_ON" && "Virtual Try-On"}
              </h3>
              <button
                onClick={() => { setActiveModal(null); setFaceFile(null); setSelectedCharacterId(null); setDressFile(null); }}
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
                  {submitting ? "Submitting..." : `Face Swap — ${faceSwapCost}cr`}
                </Button>
              </div>
            )}

            {activeModal === "VIRTUAL_TRY_ON" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">Upload a garment image (dress, top, or outfit).</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setDressFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text-primary)]"
                />
                {dressFile && <p className="text-[10px] text-[var(--text-muted)]">{dressFile.name}</p>}
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={!dressFile || submitting}
                  onClick={handleVirtualTryOn}
                >
                  {submitting ? "Submitting..." : `Try On — ${POST_PROCESS_COSTS.VIRTUAL_TRY_ON}cr`}
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
