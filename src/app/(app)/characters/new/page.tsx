"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";
import { CharacterPreviewGrid } from "@/components/character-preview-grid";

const STYLE_OPTIONS = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "cinematic", label: "Cinematic" },
  { value: "stylized", label: "Stylized" },
  { value: "anime", label: "Anime" },
];

const MODEL_OPTIONS = [
  { value: "gemini-2.0-flash-exp-image-generation", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

const COUNT_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
];

export default function NewCharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const initialTab =
    searchParams.get("tab") === "description" || initialPrompt
      ? "description"
      : "photo";

  const [tab, setTab] = useState(initialTab);
  const [description, setDescription] = useState(initialPrompt);
  const [style, setStyle] = useState("photorealistic");
  const [model, setModel] = useState("gemini-2.0-flash-exp-image-generation");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [count, setCount] = useState("4");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [error, setError] = useState<string | null>(null);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSaveImage, setSelectedSaveImage] = useState(0);
  const [saving, setSaving] = useState(false);

  const photoPreviewRef = useRef<string | null>(null);

  const hasImages = images.some((img) => img !== null);
  const generatedImages = images.filter(Boolean) as string[];

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    };
  }, []);

  // Update images array when count changes
  useEffect(() => {
    const n = parseInt(count);
    setImages((prev) => {
      if (prev.length === n) return prev;
      const next = Array(n).fill(null);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }, [count]);

  const handlePhotoSelect = useCallback((file: File) => {
    setPhoto(file);
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    const url = URL.createObjectURL(file);
    photoPreviewRef.current = url;
    setPhotoPreview(url);
  }, []);

  const handleGenerate = async () => {
    if (tab === "photo" && !photo) {
      setError("Please upload a reference photo");
      return;
    }
    if (tab === "description" && !description.trim()) {
      setError("Please describe your character");
      return;
    }

    setError(null);
    setGenerating(true);
    const n = parseInt(count);
    setImages(Array(n).fill(null));

    try {
      const formData = new FormData();
      formData.append("name", description.trim().slice(0, 40) || "Character");
      formData.append("style", style);
      formData.append("mode", tab);
      formData.append("model", model);
      formData.append("aspectRatio", aspectRatio);
      if (description.trim()) formData.append("description", description.trim());
      if (photo) formData.append("photo", photo);

      const res = await fetch("/api/characters/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "insufficient_credits") {
          setError(
            `Not enough credits. Need ${data.required}, have ${data.available}.`
          );
          setGenerating(false);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          if (!chunk.startsWith("data: ")) continue;
          const data = JSON.parse(chunk.slice(6));

          if (data.type === "image") {
            setImages((prev) => {
              const next = [...prev];
              if (data.index < next.length) next[data.index] = data.url;
              return next;
            });
          } else if (data.type === "complete") {
            setGenerating(false);
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
      setGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  };

  const handleOpenSave = () => {
    if (generatedImages.length === 0) return;
    setSelectedSaveImage(0);
    setSaveName("");
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    if (!saveName.trim() || saving) return;

    setSaving(true);
    try {
      const referenceImages = images.filter(Boolean) as string[];
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          description: description.trim() || null,
          style,
          referenceImages,
        }),
      });

      if (!res.ok) throw new Error("Failed to save character");
      const character = await res.json();
      router.push(`/characters/${character.id}`);
    } catch {
      setError("Failed to save character");
      setSaving(false);
      setShowSaveModal(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ─── Top: Generated Images ─── */}
      <div className="flex-1 flex items-center justify-center px-6 pt-4 pb-2">
        {hasImages || generating ? (
          <div className="w-full max-w-5xl">
            <CharacterPreviewGrid
              images={images}
              generating={generating}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--border-default)] bg-[var(--bg-input)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <div>
              <p className="text-[var(--text-base)] font-medium text-[var(--text-secondary)]">
                No images generated yet
              </p>
              <p className="mt-1 text-[var(--text-sm)] text-[var(--text-muted)]">
                Configure your settings below and hit Generate
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Action Bar (between preview and controls) ─── */}
      {hasImages && !generating && (
        <div className="flex items-center justify-center gap-3 px-6 pb-3">
          <button
            onClick={handleGenerate}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-2 text-[var(--text-sm)] font-medium text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Regenerate
          </button>
          <button
            onClick={handleOpenSave}
            className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110"
          >
            Save Character
          </button>
        </div>
      )}

      {/* ─── Bottom: Control Panel ─── */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-5xl px-6 py-4">
          {/* Row 1: Settings selectors */}
          <div className="mb-3 flex flex-wrap items-end gap-4">
            {/* Mode toggle */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Mode
              </span>
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
                <button
                  type="button"
                  onClick={() => setTab("description")}
                  className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--text-sm)] font-medium transition-all duration-200 ${
                    tab === "description"
                      ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setTab("photo")}
                  className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--text-sm)] font-medium transition-all duration-200 ${
                    tab === "photo"
                      ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Photo
                </button>
              </div>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Model
              </span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="appearance-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 pr-8 text-[var(--text-sm)] text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8690' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Style */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Style
              </span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="appearance-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 pr-8 text-[var(--text-sm)] text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8690' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ratio
              </span>
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAspectRatio(opt.value)}
                    className={`rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[var(--text-xs)] font-medium transition-all duration-200 ${
                      aspectRatio === opt.value
                        ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Count
              </span>
              <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
                {COUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCount(opt.value)}
                    className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--text-xs)] font-medium transition-all duration-200 ${
                      count === opt.value
                        ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Reference image + prompt + generate */}
          <div className="flex items-stretch gap-3">
            {/* Reference image (compact) */}
            {tab === "photo" && (
              <div className="w-[120px] flex-shrink-0">
                {photoPreview ? (
                  <div
                    className="group relative h-full w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] cursor-pointer"
                    onClick={() => {
                      setPhoto(null);
                      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
                      photoPreviewRef.current = null;
                      setPhotoPreview(null);
                    }}
                  >
                    <img
                      src={photoPreview}
                      alt="Reference"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <UploadZone
                    onFile={handlePhotoSelect}
                    preview={null}
                    className="h-full min-h-[56px] !rounded-[var(--radius-md)] !border-[var(--border-default)] !p-2 [&_p]:!text-[9px] [&_svg]:!h-5 [&_svg]:!w-5"
                  />
                )}
              </div>
            )}

            {/* Prompt textarea */}
            <div className="relative flex-1">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  tab === "photo"
                    ? "Describe style, clothing, mood, setting..."
                    : "Describe your character in detail..."
                }
                rows={2}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 pr-24 text-[var(--text-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] hover:border-[var(--text-muted)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !generating) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
              {/* Generate button inside textarea */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-3 py-1.5 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)]" />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error + credit cost */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              {error && (
                <p className="text-[var(--text-sm)] text-[var(--error)]">{error}</p>
              )}
            </div>
            <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
              {parseInt(count) * 10} credits ({count} {parseInt(count) === 1 ? "image" : "images"} x 10)
            </p>
          </div>
        </div>
      </div>

      {/* ─── Save Character Modal ─── */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => !saving && setShowSaveModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => !saving && setShowSaveModal(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="mb-4 text-center font-display text-lg font-bold text-[var(--text-primary)]">
              Save Character
            </h3>

            {/* Character image */}
            <div className="mb-4 flex justify-center">
              {generatedImages.length > 1 ? (
                <div className="flex gap-2">
                  {generatedImages.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSaveImage(i)}
                      className={`relative h-16 w-16 overflow-hidden rounded-[var(--radius-md)] border-2 transition-all duration-200 ${
                        selectedSaveImage === i
                          ? "border-[var(--accent-amber)] shadow-[0_0_12px_rgba(232,166,52,0.3)]"
                          : "border-[var(--border-subtle)] opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={src} alt={`Option ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : generatedImages[0] ? (
                <div className="h-32 w-32 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
                  <img src={generatedImages[0]} alt="Character" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>

            {/* Selected image large preview */}
            {generatedImages.length > 1 && generatedImages[selectedSaveImage] && (
              <div className="mb-4 flex justify-center">
                <div className="h-40 w-40 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
                  <img
                    src={generatedImages[selectedSaveImage]}
                    alt="Selected"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Name input */}
            <input
              type="text"
              placeholder="Character name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveName.trim()) handleSave();
              }}
              autoFocus
              className="mb-4 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-center text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] focus:ring-offset-1 focus:ring-offset-[var(--bg-surface)]"
            />

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-2.5 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Character"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
