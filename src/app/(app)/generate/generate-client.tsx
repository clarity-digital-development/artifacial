"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SubscriptionTier } from "@/generated/prisma/client";

// ─── Types ───

type Character = {
  id: string;
  name: string;
  referenceImages: string[];
  faceImageUrl: string | null;
};

type WorkflowTab = {
  key: string;
  label: string;
  description: string;
};

const TABS: WorkflowTab[] = [
  { key: "IMAGE_TO_VIDEO", label: "Image to Video", description: "Animate a character image with a motion prompt" },
  { key: "FACE_SWAP", label: "Face Swap", description: "Swap your character's face onto existing video" },
  { key: "TEXT_TO_VIDEO", label: "Text to Video", description: "Generate video from text with character consistency" },
  { key: "MOTION_TRANSFER", label: "Motion Transfer", description: "Copy movement from a reference video" },
  { key: "TALKING_HEAD", label: "Talking Head", description: "Audio-driven lip sync and facial animation" },
  { key: "STYLE_TRANSFER", label: "Style Transfer", description: "Restyle existing footage" },
];

const DURATIONS = [
  { value: 5, label: "5s", credits: 200 },
  { value: 10, label: "10s", credits: 400 },
];

const RESOLUTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "1440p", label: "1440p" },
];

interface GenerateClientProps {
  characters: Character[];
  totalCredits: number;
  tier: SubscriptionTier;
  canUse1080p: boolean;
  canUse1440p: boolean;
}

export function GenerateClient({ characters, totalCredits, tier, canUse1080p, canUse1440p }: GenerateClientProps) {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("720p");
  const [quality, setQuality] = useState<"std" | "pro">("std");

  // File uploads
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Sliders
  const [faceRestoreStrength, setFaceRestoreStrength] = useState(80);
  const [ipAdapterStrength, setIpAdapterStrength] = useState(70);
  const [expressionIntensity, setExpressionIntensity] = useState(80);
  const [denoiseStrength, setDenoiseStrength] = useState(60);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creditCost = duration * 40; // 40 credits per second
  const canAfford = totalCredits >= creditCost;

  const resolutionAllowed = (res: string) => {
    if (res === "720p") return true;
    if (res === "1080p") return canUse1080p;
    if (res === "1440p") return canUse1440p;
    return false;
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // Clear stale file state for tabs that don't use them
    if (!["FACE_SWAP", "MOTION_TRANSFER", "STYLE_TRANSFER"].includes(key)) setSourceVideo(null);
    if (key !== "TALKING_HEAD") setAudioFile(null);
  };

  const handleGenerate = async () => {
    if (generating || !canAfford) return;
    setGenerating(true);
    setError(null);
    // TODO: Submit to generation API when backend is ready
    setTimeout(() => {
      setError("Generation pipeline not yet connected. ComfyUI workflows pending.");
      setGenerating(false);
    }, 1500);
  };

  const needsCharacter = ["IMAGE_TO_VIDEO", "FACE_SWAP", "TEXT_TO_VIDEO", "MOTION_TRANSFER", "TALKING_HEAD"].includes(activeTab);
  const needsPrompt = ["IMAGE_TO_VIDEO", "TEXT_TO_VIDEO", "STYLE_TRANSFER"].includes(activeTab);
  const needsVideoUpload = ["FACE_SWAP", "MOTION_TRANSFER", "STYLE_TRANSFER"].includes(activeTab);
  const needsAudioUpload = activeTab === "TALKING_HEAD";

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Create Video
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Choose a generation mode and configure your settings
        </p>
      </div>

      {/* Tab Bar */}
      <div className="mb-8 flex gap-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`whitespace-nowrap rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              activeTab === tab.key
                ? "bg-[var(--accent-amber)] text-[#0A0A0B] shadow-[0_0_12px_rgba(232,166,52,0.15)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main Form Area */}
        <div className="space-y-6">
          {/* Mode Description */}
          <p className="text-sm text-[var(--text-secondary)]">
            {TABS.find((t) => t.key === activeTab)?.description}
          </p>

          {/* Character Selector */}
          {needsCharacter && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Character
              </label>
              {characters.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] p-6 text-center">
                  <p className="text-sm text-[var(--text-muted)]">
                    No characters yet.{" "}
                    <a href="/characters/new" className="text-[var(--accent-amber)] hover:underline">
                      Create one first
                    </a>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => setSelectedCharacter(char.id)}
                      className={`group flex flex-col items-center gap-2 rounded-[var(--radius-md)] border p-3 transition-all duration-200 ${
                        selectedCharacter === char.id
                          ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 shadow-[0_0_16px_rgba(232,166,52,0.1)]"
                          : "border-[var(--border-default)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                        {char.referenceImages[0] ? (
                          <img
                            src={char.referenceImages[0]}
                            alt={char.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg text-[var(--text-muted)]">
                            {char.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                        {char.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prompt */}
          {needsPrompt && (
            <Textarea
              label={activeTab === "STYLE_TRANSFER" ? "Style Description" : "Scene Description"}
              placeholder={
                activeTab === "STYLE_TRANSFER"
                  ? "Describe the desired visual style..."
                  : "Describe the motion and scene..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          )}

          {/* Video Upload */}
          {needsVideoUpload && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                {activeTab === "FACE_SWAP" ? "Target Video" : activeTab === "MOTION_TRANSFER" ? "Reference Motion Video" : "Source Video"}
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-default)] p-8 transition-colors hover:border-[var(--accent-amber)]">
                {sourceVideo ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{sourceVideo.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {(sourceVideo.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <button
                      onClick={(e) => { e.preventDefault(); setSourceVideo(null); }}
                      className="mt-2 text-xs text-[var(--error)] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-[var(--text-muted)]">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm text-[var(--text-muted)]">
                      Click or drag to upload video
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">MP4, max 30 seconds</p>
                  </>
                )}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => setSourceVideo(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {/* Audio Upload */}
          {needsAudioUpload && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Audio
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-default)] p-8 transition-colors hover:border-[var(--accent-amber)]">
                {audioFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{audioFile.name}</p>
                    <button
                      onClick={(e) => { e.preventDefault(); setAudioFile(null); }}
                      className="mt-2 text-xs text-[var(--error)] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-[var(--text-muted)]">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                    <p className="text-sm text-[var(--text-muted)]">
                      Click or drag to upload audio
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">MP3 or WAV</p>
                  </>
                )}
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {/* Workflow-specific sliders */}
          {activeTab === "FACE_SWAP" && (
            <SliderControl
              label="Face Restore Strength"
              value={faceRestoreStrength}
              onChange={setFaceRestoreStrength}
            />
          )}

          {activeTab === "TEXT_TO_VIDEO" && (
            <SliderControl
              label="Identity Preservation"
              value={ipAdapterStrength}
              onChange={setIpAdapterStrength}
              description="How closely to preserve the character's appearance"
            />
          )}

          {activeTab === "TALKING_HEAD" && (
            <SliderControl
              label="Expression Intensity"
              value={expressionIntensity}
              onChange={setExpressionIntensity}
            />
          )}

          {activeTab === "STYLE_TRANSFER" && (
            <SliderControl
              label="Transformation Strength"
              value={denoiseStrength}
              onChange={setDenoiseStrength}
              description="How much to transform from the original"
            />
          )}
        </div>

        {/* Settings Sidebar */}
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Settings
            </h3>

            {/* Duration */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`flex flex-col items-center rounded-[var(--radius-sm)] border px-2 py-2 text-center transition-all duration-150 ${
                      duration === d.value
                        ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                        : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className="text-[10px] opacity-60">{d.credits}cr</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Resolution
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((r) => {
                  const locked = !resolutionAllowed(r.value);
                  return (
                    <button
                      key={r.value}
                      onClick={() => !locked && setResolution(r.value)}
                      disabled={locked}
                      className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-all duration-150 ${
                        resolution === r.value
                          ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                          : locked
                            ? "cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-muted)] opacity-40"
                            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      {r.value}
                      {locked && (
                        <span className="ml-1 text-[10px]">
                          {r.value === "1080p" ? "Creator+" : "Pro+"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Quality
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["std", "pro"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-all duration-150 ${
                      quality === q
                        ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5 text-[var(--accent-amber)]"
                        : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    {q === "std" ? "Standard" : "High Quality"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Credit Cost</span>
              <span className="text-lg font-semibold text-[var(--accent-amber)]">
                {creditCost}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Balance</span>
              <span className={canAfford ? "" : "text-[var(--error)]"}>
                {totalCredits.toLocaleString()} credits
              </span>
            </div>

            {!canAfford && (
              <p className="mt-3 text-xs text-[var(--error)]">
                Insufficient credits.{" "}
                <a href="/settings" className="underline">Buy more</a>
              </p>
            )}
          </div>

          {/* Generate Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleGenerate}
            disabled={generating || !canAfford || !resolutionAllowed(resolution) || (needsCharacter && !selectedCharacter)}
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                </svg>
                Generating...
              </span>
            ) : (
              `Generate — ${creditCost} credits`
            )}
          </Button>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--error)]/20 bg-[var(--error)]/5 px-4 py-3">
              <p className="text-xs text-[var(--error)]">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Slider Component ───

function SliderControl({
  label,
  value,
  onChange,
  description,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </label>
        <span className="text-sm tabular-nums text-[var(--accent-amber)]">
          {value}%
        </span>
      </div>
      {description && (
        <p className="mb-2 text-xs text-[var(--text-muted)]">{description}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent-amber)]"
      />
    </div>
  );
}
