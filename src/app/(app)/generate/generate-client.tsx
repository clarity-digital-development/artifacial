"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { UploadZone } from "@/components/upload-zone";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SettingsSheet } from "@/components/generate/settings-sheet";
import { BottomButton } from "@/components/generate/bottom-button";
import { GenerationDetailsCard } from "@/components/generate/generation-details-card";
import { TutorialOverlay, TutorialPhase, TUTORIAL_PHASE_KEY, TUTORIAL_DONE_KEY } from "@/components/tutorial-overlay";

// ─── Client-side model data (mirrors registry.ts for use in the browser) ───

type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
type ModelMode = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";
type ModelContentMode = "SFW" | "NSFW" | "BOTH";

type CreditCostTable = Record<string, number>;

type ClientModel = {
  id: string;
  name: string;
  provider: "PIAPI" | "VENICE" | "KIEAI";
  tier: ModelTier;
  creditCost: number;
  creditCostTable?: CreditCostTable;
  audioCreditAddon?: Record<string, number>;
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
  badge?: string;
};

function getModelCreditCost(model: ClientModel, durationSec: number, resolution: string, audio: boolean = false): number {
  if (model.supportedModes.includes("T2I")) return model.creditCost;

  let baseCredits: number | undefined;

  if (model.creditCostTable) {
    // Try exact key: "5_720p"
    const exact = model.creditCostTable[`${durationSec}_${resolution}`];
    if (exact != null) baseCredits = exact;
    // Try duration only: "5"
    if (baseCredits === undefined) {
      const durOnly = model.creditCostTable[`${durationSec}`];
      if (durOnly != null) baseCredits = durOnly;
    }
    // Interpolate from first entry
    if (baseCredits === undefined) {
      const keys = Object.keys(model.creditCostTable).sort((a, b) => parseInt(a) - parseInt(b));
      if (keys.length > 0) {
        const baseDur = parseInt(keys[0]);
        const baseCost = model.creditCostTable[keys[0]];
        baseCredits = Math.ceil((baseCost / baseDur) * durationSec);
      }
    }
  }

  if (baseCredits === undefined) {
    const multiplier = Math.ceil(durationSec / 5);
    baseCredits = model.creditCost * multiplier;
  }

  // Add audio surcharge
  let audioCredits = 0;
  if (audio && model.audioCreditAddon) {
    audioCredits = model.audioCreditAddon[`${durationSec}`]
      ?? model.audioCreditAddon[`${Math.ceil(durationSec / 5) * 5}`]
      ?? 0;
  }

  return baseCredits + audioCredits;
}

const MODELS: ClientModel[] = [
  // ── SFW Budget ──
  { id: "wan-22", name: "Wan 2.2", provider: "PIAPI", tier: "BUDGET", creditCost: 300, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Economy option. Fast generation.", durations: [5], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "wan-26", name: "Wan 2.6", provider: "PIAPI", tier: "BUDGET", creditCost: 1700, creditCostTable: { "5_720p": 1700, "10_720p": 3300, "5_1080p": 2500, "10_1080p": 4900 }, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Budget option. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "framepack", name: "Framepack", provider: "PIAPI", tier: "BUDGET", creditCost: 300, creditCostTable: { "10": 300, "15": 450, "20": 600, "30": 900 }, supportedModes: ["I2V"], maxDuration: 30, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Long-form I2V. Up to 30 seconds.", durations: [10, 15, 20, 30], aspectRatios: [], resolutions: [], supportsEndFrame: true },
  // ── SFW Standard ──
  { id: "kling-26-std", name: "Kling 2.6 Standard", provider: "PIAPI", tier: "STANDARD", creditCost: 850, creditCostTable: { "5": 850, "10": 1700 }, audioCreditAddon: { "5": 550, "10": 1100 }, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "720p", supportsAudio: true, contentMode: "SFW", description: "Reliable standard quality. Native audio.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: true },
  { id: "seedance-2", name: "Seedance 2", provider: "PIAPI", tier: "STANDARD", creditCost: 1100, creditCostTable: { "5": 1100 }, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "ByteDance's latest.", durations: [5], aspectRatios: ["16:9", "9:16", "4:3", "3:4"], resolutions: [], supportsEndFrame: false },
  { id: "luma", name: "Luma", provider: "PIAPI", tier: "STANDARD", creditCost: 850, creditCostTable: { "5": 850 }, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Luma video generation.", durations: [5], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: false },
  { id: "hailuo", name: "Hailuo", provider: "PIAPI", tier: "STANDARD", creditCost: 850, creditCostTable: { "5": 850 }, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Hailuo video generation.", durations: [5], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: false },
  { id: "sora-2", name: "Sora 2", provider: "PIAPI", tier: "STANDARD", creditCost: 300, creditCostTable: { "4": 240, "8": 480, "12": 720 }, supportedModes: ["T2V", "I2V"], maxDuration: 12, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "OpenAI's video model. Up to 12 seconds.", durations: [4, 8, 12], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  // ── SFW Ultra ──
  { id: "kling-26-pro", name: "Kling 2.6 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 1400, creditCostTable: { "5": 1400, "10": 2700 }, audioCreditAddon: { "5": 550, "10": 1100 }, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Premium Kling quality with audio.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: true },
  { id: "kling-30-pro", name: "Kling 3.0", provider: "PIAPI", tier: "ULTRA", creditCost: 2100, creditCostTable: { "5_720p": 2100, "10_720p": 4100, "5_1080p": 3100, "10_1080p": 6100 }, audioCreditAddon: { "5": 1000, "10": 2000 }, supportedModes: ["T2V", "I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Best overall quality. Up to 10 seconds with audio.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"], supportsEndFrame: true },
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 500, creditCostTable: { "4_720p": 480, "8_720p": 960, "12_720p": 1440, "4_1080p": 720, "8_1080p": 1440, "12_1080p": 2160 }, supportedModes: ["T2V", "I2V"], maxDuration: 12, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "OpenAI's flagship. 1080p up to 12 seconds.", durations: [4, 8, 12], aspectRatios: ["16:9", "9:16"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "veo-31", name: "Veo 3.1", provider: "PIAPI", tier: "ULTRA", creditCost: 500, creditCostTable: { "4_720p": 480, "6_720p": 720, "8_720p": 960, "4_1080p": 720, "6_1080p": 1080, "8_1080p": 1440 }, supportedModes: ["T2V", "I2V"], maxDuration: 8, maxResolution: "1080p", supportsAudio: true, contentMode: "SFW", description: "Google's best. Cinematic quality with audio.", durations: [4, 6, 8], aspectRatios: ["16:9", "9:16"], resolutions: ["720p", "1080p"], supportsEndFrame: false },
  { id: "seedance-2-pro", name: "Seedance 2 Pro", provider: "PIAPI", tier: "ULTRA", creditCost: 1100, creditCostTable: { "5": 1100 }, supportedModes: ["T2V", "I2V"], maxDuration: 5, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "ByteDance premium. Higher quality.", durations: [5], aspectRatios: ["16:9", "9:16", "4:3", "3:4"], resolutions: [], supportsEndFrame: false },
  // ── Motion Control (Kling 3.0 only — KIE.AI, supports background_source) ──
  { id: "kling-30-motion-std", name: "Kling 3.0 Motion", provider: "KIEAI", tier: "STANDARD", creditCost: 1050, creditCostTable: { "5": 1050 }, supportedModes: ["MOTION_TRANSFER"], maxDuration: 30, maxResolution: "720p", supportsAudio: false, contentMode: "SFW", description: "Kling 3.0 motion control. 720p output. 3–30 seconds.", durations: [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], aspectRatios: [], resolutions: [], supportsEndFrame: false, badge: "New" },
  { id: "kling-30-motion-pro", name: "Kling 3.0 Motion Pro", provider: "KIEAI", tier: "ULTRA", creditCost: 2100, creditCostTable: { "5": 2100 }, supportedModes: ["MOTION_TRANSFER"], maxDuration: 30, maxResolution: "1080p", supportsAudio: false, contentMode: "SFW", description: "Kling 3.0 motion control. 1080p output. 3–30 seconds.", durations: [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], aspectRatios: [], resolutions: [], supportsEndFrame: false, badge: "New" },
  // ── NSFW Budget ──
  { id: "wan22-nsfw-t2v", name: "Wan 2.2 NSFW", provider: "VENICE", tier: "BUDGET", creditCost: 1250, creditCostTable: { "5": 1250 }, supportedModes: ["T2V"], maxDuration: 5, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Most consistent NSFW generation. Fast 720p.", durations: [5], aspectRatios: ["16:9", "9:16"], resolutions: [], supportsEndFrame: false },
  { id: "wan21-pro-nsfw-i2v", name: "Wan 2.1 Pro NSFW", provider: "VENICE", tier: "BUDGET", creditCost: 1100, creditCostTable: { "6": 1100 }, supportedModes: ["I2V"], maxDuration: 6, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Reliable unrestricted image-to-video. 6 seconds.", durations: [6], aspectRatios: ["16:9"], resolutions: [], supportsEndFrame: false },
  // ── NSFW Standard ──
  { id: "wan25-preview-nsfw-t2v", name: "Wan 2.5 NSFW", provider: "VENICE", tier: "STANDARD", creditCost: 1800, creditCostTable: { "5": 1800, "10": 3500 }, supportedModes: ["T2V"], maxDuration: 10, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Latest Wan generation. Unrestricted T2V.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: false, badge: "New" },
  { id: "wan25-preview-nsfw-i2v", name: "Wan 2.5 NSFW", provider: "VENICE", tier: "STANDARD", creditCost: 1800, creditCostTable: { "5": 1800, "10": 3500 }, supportedModes: ["I2V"], maxDuration: 10, maxResolution: "720p", supportsAudio: false, contentMode: "NSFW", description: "Latest Wan generation. Unrestricted I2V.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: [], supportsEndFrame: false, badge: "New" },
  { id: "wan26-nsfw-t2v", name: "Wan 2.6 NSFW", provider: "VENICE", tier: "STANDARD", creditCost: 1700, creditCostTable: { "5": 1700, "10": 3300 }, supportedModes: ["T2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted text-to-video. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"], supportsEndFrame: false, badge: "Beta" },
  { id: "wan26-nsfw-i2v", name: "Wan 2.6 NSFW", provider: "VENICE", tier: "STANDARD", creditCost: 1700, creditCostTable: { "5": 1700, "10": 3300 }, supportedModes: ["I2V"], maxDuration: 10, maxResolution: "1080p", supportsAudio: false, contentMode: "NSFW", description: "Unrestricted image-to-video. Up to 10 seconds.", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"], supportsEndFrame: false, badge: "Beta" },
];

// ─── Aspect ratio helpers ───

const ASPECT_RATIO_VALUES: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
};

/** Snap an image's actual pixel ratio to the closest supported aspect ratio string. */
function snapToClosestAspectRatio(imageRatio: number, supported: string[]): string {
  let closest = supported[0] ?? "16:9";
  let minDiff = Infinity;
  for (const r of supported) {
    const val = ASPECT_RATIO_VALUES[r] ?? 16 / 9;
    const diff = Math.abs(imageRatio - val);
    if (diff < minDiff) { minDiff = diff; closest = r; }
  }
  return closest;
}

/** Tailwind aspect class for a given ratio string. */
function getAspectClass(ar?: string): string {
  switch (ar) {
    case "9:16": return "aspect-[9/16]";
    case "1:1": return "aspect-square";
    case "4:3": return "aspect-[4/3]";
    case "3:4": return "aspect-[3/4]";
    case "3:2": return "aspect-[3/2]";
    case "2:3": return "aspect-[2/3]";
    default: return "aspect-video"; // 16:9
  }
}

const TIER_LABELS: Record<ModelTier, string> = {
  BUDGET: "Budget",
  STANDARD: "Standard",
  ULTRA: "Ultra",
};

const TIER_ORDER: Record<ModelTier, number> = { BUDGET: 0, STANDARD: 1, ULTRA: 2 };

const TIER_CONCURRENT_LIMITS: Record<string, number> = {
  FREE:    1,
  STARTER: 3,
  CREATOR: 5,
  PRO:     8,
  STUDIO:  8,
};

type NextTierInfo = { name: string; limit: number; price: string };
const NEXT_TIER: Record<string, NextTierInfo | null> = {
  FREE:    { name: "Starter", limit: 3,  price: "$15/mo" },
  STARTER: { name: "Creator", limit: 5,  price: "$50/mo" },
  CREATOR: { name: "Pro",     limit: 8,  price: "$100/mo" },
  PRO:     null,
  STUDIO:  null,
};

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
  aspectRatio?: string;
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
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchParams = useSearchParams();
  const initModelId = searchParams.get("modelId");
  const initMode = searchParams.get("mode") as ModeTab | null;
  const initPrompt = searchParams.get("prompt") ?? "";
  const initCharacterId = searchParams.get("characterId");

  // Lock the main scroll container so the fixed-height generate layout
  // doesn't leave a few stray pixels of scrollable space on mobile.
  useEffect(() => {
    if (!isMobile) return;
    const main = document.querySelector("main");
    if (!main) return;
    const prev = main.style.overflow;
    main.style.overflow = "hidden";
    return () => { main.style.overflow = prev; };
  }, [isMobile]);

  const isFree = tier === "FREE";
  const isNsfw = contentMode === "NSFW" && !isFree;
  const userContentMode = isNsfw ? "NSFW" : "SFW";

  // Filter models based on content mode
  // NSFW users: hide SFW-only models that have an NSFW equivalent (avoids duplicate Wan entries)
  const NSFW_SUPERSEDED = new Set(["wan-22", "wan-26"]); // NSFW versions replace these
  const availableModels = MODELS.filter((m) => {
    if (userContentMode === "SFW") return m.contentMode === "SFW" || m.contentMode === "BOTH";
    // NSFW users: show everything except SFW models that are superseded by NSFW variants
    if (NSFW_SUPERSEDED.has(m.id) && m.contentMode === "SFW") return false;
    return true;
  });

  // Mode & model — seeded from URL params (e.g. from quick-create-bar)
  const [mode, setMode] = useState<ModeTab>(initMode ?? "T2V");
  const [selectedModelId, setSelectedModelId] = useState<string>(
    initModelId ?? (isNsfw ? "wan26-nsfw-t2v" : "kling-30-pro")
  );
  const isImageMode = false; // T2I handled in characters tab, not studio
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [prompt, setPrompt] = useState(initPrompt);
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
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("video");
  const [motionAdvancedOpen, setMotionAdvancedOpen] = useState(false);
  const [detectedImageRatio, setDetectedImageRatio] = useState<string | null>(null);

  // Queue limit (tier-based)
  const maxConcurrent = TIER_CONCURRENT_LIMITS[tier] ?? 3;
  const nextTierInfo = NEXT_TIER[tier] ?? null;
  const [showQueueUpsell, setShowQueueUpsell] = useState(false);
  const [showCreditsUpsell, setShowCreditsUpsell] = useState(false);

  // Tutorial — show when tutorial phase targets this page
  const [tutorialPhase, setTutorialPhase] = useState<TutorialPhase | null>(null);
  useEffect(() => {
    const done = localStorage.getItem(TUTORIAL_DONE_KEY);
    if (done === "1") return;
    const phase = localStorage.getItem(TUTORIAL_PHASE_KEY) as TutorialPhase | null;
    if (phase === "generate-tour" || phase === "generate-video") {
      setTutorialPhase(phase);
    }
  }, []);

  // Popup state for duration/aspect/quality pickers
  const [durationPopupOpen, setDurationPopupOpen] = useState(false);
  const [aspectPopupOpen, setAspectPopupOpen] = useState(false);
  const [qualityPopupOpen, setQualityPopupOpen] = useState(false);
  const durationPopupRef = useRef<HTMLDivElement>(null);
  const aspectPopupRef = useRef<HTMLDivElement>(null);
  const qualityPopupRef = useRef<HTMLDivElement>(null);

  // Character picker for I2V
  const [imageSource, setImageSource] = useState<"upload" | "character">(initCharacterId ? "character" : "upload");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(initCharacterId);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? null;


  // Generation feed — persisted to sessionStorage so navigating away doesn't lose state
  const STORAGE_KEY = "artifacial_generations";
  const [generations, setGenerations] = useState<GenerationItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
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
      label: TIER_LABELS[t],
      models: filteredModels.filter((m) => m.tier === t),
    }))
    .filter((g) => g.models.length > 0);

  const selectedModel = availableModels.find((m) => m.id === selectedModelId) ?? filteredModels[0];

  // Credit cost: use table lookup when available, fallback to base cost
  const audioEnabled = withAudio && (selectedModel?.supportsAudio ?? false);
  const creditCost = selectedModel ? getModelCreditCost(selectedModel, durationSec, resolution, audioEnabled) : 1;
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
      SFW: { T2V: "kling-30-pro", I2V: "kling-30-pro", MOTION_TRANSFER: "kling-30-motion-pro" },
      NSFW: { T2V: "wan26-nsfw-t2v", I2V: "wan26-nsfw-i2v", MOTION_TRANSFER: "kling-30-motion-pro" },
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

  // Handle image file — detect dimensions and auto-snap aspect ratio
  const handleImageFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(url);

    // Detect intrinsic dimensions, snap ratio selector to closest supported value
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const supported = availableAspectRatios.length > 0 ? availableAspectRatios : ["16:9", "9:16", "1:1"];
        const snapped = snapToClosestAspectRatio(ratio, supported);
        setAspectRatio(snapped);
        setDetectedImageRatio(snapped);
      }
    };
    img.src = url;
  }, [availableAspectRatios]);

  const clearImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setDetectedImageRatio(null);
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

  // Persist generations to sessionStorage on every change
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(generations)); } catch {}
  }, [generations]);

  // Resume polling for in-progress generations on mount (e.g. after navigating back)
  const hasResumed = useRef(false);
  useEffect(() => {
    if (hasResumed.current) return;
    hasResumed.current = true;
    generations.forEach((g) => {
      if (
        g.generationId &&
        (g.status === "queued" || g.status === "processing" || g.status === "submitting")
      ) {
        startPollingFor(g.id, g.generationId);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollRefs.current.forEach((interval) => clearInterval(interval));
      timerRefs.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // ─── Submit ───

  const handleSubmit = async () => {
    if (isMobile) setSheetOpen(false);
    if (submitting || (!isMotionMode && !prompt.trim())) return;
    if (!canAfford) { setShowCreditsUpsell(true); return; }
    if (inFlightCount >= maxConcurrent) { setShowQueueUpsell(true); return; }

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
      aspectRatio: showAspectRatio ? aspectRatio : undefined,
    };

    setGenerations((prev) => [newItem, ...prev]);
    setSelectedId(itemId);
    setSubmitting(true);

    try {
      let imageUrl: string | undefined;
      if (isMotionMode) {
        // Motion transfer: uploaded image only
        if (imageFile) {
          imageUrl = await uploadFileToR2(imageFile);
        }
      } else if (needsImage && imageSource === "character" && selectedCharacter?.referenceImageKey) {
        // I2V character picker
        imageUrl = `r2:${selectedCharacter.referenceImageKey}`;
      } else if (needsImage && imageFile) {
        imageUrl = await uploadFileToR2(imageFile);
      }

      let videoUrl: string | undefined;
      if (needsVideo && videoFile) {
        videoUrl = await uploadFileToR2(videoFile);
      }

      let endImageUrl: string | undefined;
      if (mode === "I2V" && modelSupportsEndFrame && endImageFile) {
        endImageUrl = await uploadFileToR2(endImageFile);
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
      if (imageSource === "character" && selectedCharacterId) body.characterId = selectedCharacterId;
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
    if (genMode === "T2V" || genMode === "I2V" || genMode === "MOTION_TRANSFER") {
      setMode(genMode);
    }
    setSelectedModelId(model.id);
    setPrompt(gen.prompt);
    setDurationSec(gen.durationSec);
    setWithAudio(gen.withAudio);
  };

  // ─── Settings Content (shared between desktop sidebar and mobile sheet) ───

  const settingsContent = (
    <>
      {/* Mode Toggle */}
      <div data-tutorial="mode-tabs" className="mb-5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
        {(["T2V", "I2V", "MOTION_TRANSFER"] as const)
          .map((tab) => (
          <button
            key={tab}
            onClick={() => { setMode(tab); if (tab === "MOTION_TRANSFER") setPrompt(""); }}
            className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === tab
                ? "bg-[var(--accent-amber)] text-[#0A0A0B]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab === "T2V" ? "Text → Video" : tab === "I2V" ? "Image → Video" : "Motion"}
            </button>
          ))}
        </div>

        {/* Model selector dropdown */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Model
        </label>
        <div data-tutorial="model-picker" ref={dropdownRef} className="relative mb-4">
          {/* Trigger button — shows selected model */}
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className={`flex w-full items-center justify-between border px-3 py-2.5 text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              modelDropdownOpen
                ? "rounded-t-[var(--radius-md)] rounded-b-none border-[var(--accent-amber)] bg-[var(--accent-amber)]/5"
                : "rounded-[var(--radius-md)] border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]"
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
                <span>{selectedModel ? `${getModelCreditCost(selectedModel, durationSec, resolution, audioEnabled).toLocaleString()} cr` : ""}</span>
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
            <div className="absolute left-0 right-0 top-full z-50 max-h-[320px] overflow-y-auto rounded-b-[var(--radius-md)] border border-t-0 border-[var(--accent-amber)] bg-[var(--bg-surface)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                            {model.badge && (
                              <span className="shrink-0 rounded bg-[var(--accent-amber)]/15 px-1 py-0.5 text-[8px] font-bold text-[var(--accent-amber)]">
                                {model.badge}
                              </span>
                            )}
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

        {/* Prompt — hidden in motion mode (prompt is in Advanced Settings there) */}
        {!isMotionMode && (
          <>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Prompt
            </label>
            <div data-tutorial="prompt-area" className="relative mb-1">
              <textarea
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your scene..."
                rows={5}
                maxLength={2000}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] hover:border-[var(--text-muted)]"
                style={{ minHeight: "120px", maxHeight: "160px", overflow: "auto" }}
              />
            </div>
            <p className="mb-4 text-right text-[10px] tabular-nums text-[var(--text-muted)]">
              {prompt.length}/2000
            </p>
          </>
        )}

        {/* Motion Transfer — tabbed image + video pickers */}
        {isMotionMode && needsImage && needsVideo && (
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-3">

              {/* ── Character Image ── */}
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
                    className="!p-3 !min-h-[80px]"
                  />
                )}
              </div>

              {/* ── Reference Video ── */}
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
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                    className="!p-3 !min-h-[80px]"
                  />
                )}
              </div>
            </div>

            {/* Motion info note */}
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">
              Motion and background source are set by the reference video (Video) or your character image (Image). Use Scene Description to further describe the environment.
            </p>

            {/* Advanced Settings */}
            <div className="mt-3">
              <button
                onClick={() => setMotionAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <span>Advanced Settings</span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform duration-200 ${motionAdvancedOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {motionAdvancedOpen && (
                <div className="mt-2 space-y-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  {/* Background Source */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Background Source
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCharacterOrientation("video")}
                        className={`flex-1 rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                          characterOrientation === "video"
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        Reference Video
                      </button>
                      <button
                        onClick={() => setCharacterOrientation("image")}
                        className={`flex-1 rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                          characterOrientation === "image"
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        Character Image
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {characterOrientation === "video"
                        ? "Character is placed into the reference video's background — motion & scene from video"
                        : "Character stays in their original image background — portrait compositing"}
                    </p>
                  </div>
                  {/* Scene Description */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Scene Description <span className="normal-case font-normal text-[var(--text-muted)]/70">(optional)</span>
                    </p>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the environment — e.g. 'dancing in a neon-lit nightclub' (the reference video drives the motion, not the scene)"
                      rows={3}
                      maxLength={2000}
                      className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] hover:border-[var(--text-muted)]"
                    />
                  </div>
                </div>
              )}
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
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
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
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium transition-colors ${
                  detectedImageRatio && detectedImageRatio !== aspectRatio
                    ? "border-amber-500/60 text-amber-400 hover:border-amber-400"
                    : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><rect x="2" y="3" width="20" height="18" rx="2"/></svg>
                {aspectRatio}
                {detectedImageRatio && detectedImageRatio !== aspectRatio && (
                  <span className="ml-0.5 text-[9px]">⚠</span>
                )}
              </button>
              {aspectPopupOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aspect Ratio</p>
                  {detectedImageRatio && (
                    <p className="mb-1.5 px-1 text-[10px] text-amber-400/80">
                      Image detected as {detectedImageRatio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {availableAspectRatios.map((ar) => (
                      <button
                        key={ar}
                        onClick={() => { setAspectRatio(ar); setAspectPopupOpen(false); }}
                        className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                          aspectRatio === ar
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                            : ar === detectedImageRatio
                            ? "border-amber-500/40 text-amber-400/80 hover:border-amber-400"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        {ar}{ar === detectedImageRatio && aspectRatio !== ar ? " ✓" : ""}
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
        <div data-tutorial="generate-btn">
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          disabled={
            submitting ||
            (!isMotionMode && !prompt.trim()) ||
            // Motion transfer: needs uploaded image and video
            (isMotionMode && needsImage && !imageFile) ||
            (needsVideo && !videoFile) ||
            // I2V (non-motion) image requirements
            (!isMotionMode && needsImage && imageSource === "upload" && !imageFile) ||
            (!isMotionMode && needsImage && imageSource === "character" && (!selectedCharacterId || !selectedCharacter?.referenceImageKey))
          }
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
              </svg>
              Submitting...
            </span>
          ) : (
            `Generate — ${creditCost.toLocaleString()} cr`
          )}
        </Button>
        </div>
    </>
  );

  // ─── Render ───

  return (
    <>
    <div className={`no-stagger flex relative bg-[var(--bg-deep)] ${isMobile ? "-mx-4 -my-4 h-[calc(100vh-56px-60px)] pb-16" : "-mx-8 -my-6 lg:-mx-12 h-[calc(100vh-var(--topbar-h,64px))]"}`}>
      {/* ─── LEFT PANEL (desktop only) ─── */}
      {!isMobile && (
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-deep)]/50 p-5">
          {settingsContent}
        </div>
      )}

      {/* ─── CENTER PANEL ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {generations.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className={`rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-default)] text-center ${isMobile ? "px-8 py-12" : "px-12 py-16"}`}>
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
                {isMobile ? "Tap New Generation to start" : "Configure your settings and click Generate"}
              </p>
            </div>
          </div>
        ) : isMobile ? (
          /* Mobile: vertically stacked generations */
          <div className="flex-1 overflow-y-auto pb-24">
            <div className="flex flex-col gap-6 p-4">
              {[...generations].reverse().map((gen) => (
                <div key={gen.id}>
                  {gen.status === "completed" && gen.outputUrl ? (
                    gen.outputUrl.match(/\.(png|jpg|jpeg|webp)($|\?)/) || gen.durationSec === 0 ? (
                      <img src={gen.outputUrl} alt={gen.prompt} className="w-full rounded-[var(--radius-lg)]" />
                    ) : (
                      <video src={gen.outputUrl} controls autoPlay muted playsInline className="w-full rounded-[var(--radius-lg)]" />
                    )
                  ) : gen.status === "failed" ? (
                    <div className={`flex ${getAspectClass(gen.aspectRatio)} items-center justify-center rounded-[var(--radius-lg)] border border-[var(--error)]/20 bg-[var(--error)]/5`}>
                      <p className="text-sm text-[var(--error)]">Generation Failed</p>
                    </div>
                  ) : (
                    <div className={`flex ${getAspectClass(gen.aspectRatio)} items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]`}>
                      <div className="text-center">
                        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                        <p className="text-sm text-[var(--text-muted)]">Generating...</p>
                        <p className="mt-1 text-xs tabular-nums text-[var(--text-muted)]">{formatElapsed(gen.elapsedSec)}</p>
                      </div>
                    </div>
                  )}
                  <GenerationDetailsCard
                    prompt={gen.prompt}
                    modelName={gen.modelName}
                    durationSec={gen.durationSec}
                    resolution={gen.resolution}
                    withAudio={gen.withAudio}
                    creditCost={gen.creditCost}
                    status={gen.status}
                    errorMessage={gen.errorMessage}
                    createdAt={gen.createdAt}
                    generationTimeMs={gen.generationTimeMs}
                    outputUrl={gen.outputUrl}
                    onDownload={gen.outputUrl ? () => {
                      const a = document.createElement("a");
                      a.href = gen.outputUrl!;
                      const ext = gen.outputUrl?.match(/\.(png|jpg|jpeg|webp)/) ? "webp" : "mp4";
                      a.download = `artifacial-${gen.generationId}.${ext}`;
                      a.click();
                    } : undefined}
                    onRegenerate={() => handleRegenerate(gen)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Desktop: preview + thumbnail strip + inline details */
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

      {/* ─── RIGHT PANEL (Details) — desktop only ─── */}
      {!isMobile && (
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
                <MetaRow label="Credits" value={`${selectedGeneration.creditCost.toLocaleString()}`} />
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
                {/* Cancel — for stuck/in-progress generations */}
                {(selectedGeneration.status === "queued" || selectedGeneration.status === "processing" || selectedGeneration.status === "submitting") && selectedGeneration.generationId && (
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={async () => {
                      const res = await fetch(`/api/generate/${selectedGeneration.generationId}`, { method: "DELETE" });
                      if (res.ok) {
                        stopPollingFor(selectedGeneration.id);
                        setGenerations((prev) =>
                          prev.map((g) =>
                            g.id === selectedGeneration.id
                              ? { ...g, status: "failed" as const, errorMessage: "Cancelled by user" }
                              : g
                          )
                        );
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Cancel Generation
                  </Button>
                )}

                {selectedGeneration.status === "completed" && selectedGeneration.outputUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = selectedGeneration.outputUrl!;
                      const ext = selectedGeneration.outputUrl?.match(/\.(png|jpg|jpeg|webp)/) ? "webp" : "mp4";
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
      )}
    </div>

    {/* Mobile bottom button + settings sheet */}
    {isMobile && (
      <>
        <BottomButton
          isGenerating={submitting || inFlightCount > 0}
          onClick={() => setSheetOpen(true)}
        />
        <SettingsSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          {settingsContent}
        </SettingsSheet>
      </>
    )}

    {/* Queue limit upsell modal */}
    {showQueueUpsell && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowQueueUpsell(false)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={() => setShowQueueUpsell(false)}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          {/* Icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 8 5 3-5 3z"/><line x1="2" y1="21" x2="22" y2="21"/><line x1="7" y1="17" x2="7" y2="21"/><line x1="17" y1="17" x2="17" y2="21"/>
            </svg>
          </div>

          <h2 className="mb-1 font-display text-lg font-bold text-[var(--text-primary)]">
            Queue full
          </h2>
          <p className="mb-5 text-sm text-[var(--text-muted)]">
            {nextTierInfo
              ? `Your ${tier.charAt(0) + tier.slice(1).toLowerCase()} plan supports up to ${maxConcurrent} generation${maxConcurrent === 1 ? "" : "s"} at a time. Upgrade to run ${nextTierInfo.limit} at once.`
              : `You have ${maxConcurrent} generations in progress. Wait for one to finish before starting another.`
            }
          </p>

          {nextTierInfo ? (
            <>
              {/* Next tier card */}
              <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{nextTierInfo.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">Up to {nextTierInfo.limit} concurrent generations</p>
                  </div>
                  <span className="text-lg font-bold text-[var(--accent-amber)]">{nextTierInfo.price}</span>
                </div>
              </div>
              <a
                href="/settings?tab=billing"
                className="block w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-center text-sm font-semibold text-[#0A0A0B] shadow-[0_0_20px_rgba(232,166,52,0.2)] transition-opacity hover:opacity-90"
              >
                Upgrade to {nextTierInfo.name}
              </a>
              <button
                onClick={() => setShowQueueUpsell(false)}
                className="mt-2 w-full py-2 text-center text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              >
                Wait for a slot to open
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowQueueUpsell(false)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              OK, I'll wait
            </button>
          )}
        </div>
      </div>
    )}

    {/* Credits upsell modal */}
    {showCreditsUpsell && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowCreditsUpsell(false)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowCreditsUpsell(false)}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>

          <h2 className="mb-1 font-display text-lg font-bold text-[var(--text-primary)]">
            Not enough credits
          </h2>
          <p className="mb-5 text-sm text-[var(--text-muted)]">
            This generation costs <span className="font-semibold text-[var(--text-primary)]">{creditCost.toLocaleString()} credits</span> and you have <span className="font-semibold text-[var(--text-primary)]">{credits.toLocaleString()}</span>. Upgrade your plan or top up to continue.
          </p>

          {/* Plan cards */}
          <div className="mb-4 space-y-2">
            {[
              { name: "Starter", price: "$15/mo", credits: "15,000 cr/mo" },
              { name: "Creator", price: "$50/mo", credits: "60,000 cr/mo", highlight: true },
              { name: "Pro", price: "$100/mo", credits: "125,000 cr/mo" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 ${
                  plan.highlight
                    ? "border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/5"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{plan.credits}</p>
                </div>
                <span className={`text-sm font-bold ${plan.highlight ? "text-[var(--accent-amber)]" : "text-[var(--text-secondary)]"}`}>
                  {plan.price}
                </span>
              </div>
            ))}
          </div>

          <a
            href="/pricing"
            className="block w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-center text-sm font-semibold text-[#0A0A0B] shadow-[0_0_20px_rgba(232,166,52,0.2)] transition-opacity hover:opacity-90"
          >
            View plans & upgrade
          </a>
          <button
            onClick={() => setShowCreditsUpsell(false)}
            className="mt-2 w-full py-2 text-center text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
          >
            Maybe later
          </button>
        </div>
      </div>
    )}

    {/* Phase-driven tutorial */}
    {tutorialPhase && (
      <TutorialOverlay phase={tutorialPhase} onDone={() => setTutorialPhase(null)} />
    )}
    </>
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

/** Upload a file to R2 via /api/upload and return the signed URL. */
async function uploadFileToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  const data = await res.json();
  return data.url;
}
