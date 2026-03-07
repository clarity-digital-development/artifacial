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

// Inline select with custom chevron — no label
function InlineSelect({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      {icon && <span className="pointer-events-none absolute left-2.5 text-[var(--text-muted)]">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] py-1.5 pr-7 text-[var(--text-xs)] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)] ${icon ? "pl-8" : "pl-2.5"}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238A8690' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// Compact pill group — no label, tight spacing
function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-semibold transition-all duration-150 ${
            value === opt.value
              ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSaveImage, setSelectedSaveImage] = useState(0);
  const [saving, setSaving] = useState(false);

  const photoPreviewRef = useRef<string | null>(null);
  const creditCost = parseInt(count) * 10;

  const hasImages = images.some((img) => img !== null);
  const generatedImages = images.filter(Boolean) as string[];

  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    };
  }, []);

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
      setError("Upload a reference photo");
      return;
    }
    if (tab === "description" && !description.trim()) {
      setError("Describe your character");
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
          setError(`Need ${data.required} credits, have ${data.available}`);
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
      {/* ═══ Canvas: Generated Images ═══ */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8 py-6">
        {hasImages || generating ? (
          <div className="w-full max-w-4xl">
            <CharacterPreviewGrid images={images} generating={generating} />

            {/* Floating action buttons over the canvas */}
            {hasImages && !generating && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-4 py-1.5 text-[var(--text-xs)] font-medium text-[var(--text-secondary)] backdrop-blur-sm transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Redo
                </button>
                <button
                  onClick={handleOpenSave}
                  className="flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--accent-amber)] px-4 py-1.5 text-[var(--text-xs)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  Save Character
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Minimal empty state — just a subtle hint, not a giant placeholder */
          <div className="flex flex-col items-center gap-2 opacity-30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-[var(--text-muted)]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* ═══ Floating Toolbar ═══ */}
      <div className="relative z-10 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        {/* Error toast */}
        {error && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-[var(--radius-full)] border border-red-500/20 bg-red-950/90 px-4 py-1.5 text-[var(--text-xs)] text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        <div className="mx-auto max-w-4xl px-5 py-3">
          {/* Single row: all controls + prompt + generate */}
          <div className="flex items-center gap-2.5">
            {/* Mode toggle */}
            <PillGroup
              options={[
                { value: "description", label: "Text" },
                { value: "photo", label: "Photo" },
              ]}
              value={tab}
              onChange={setTab}
            />

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--border-default)]" />

            {/* Model */}
            <InlineSelect
              value={model}
              onChange={setModel}
              options={MODEL_OPTIONS}
              icon={
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              }
            />

            {/* Style */}
            <InlineSelect
              value={style}
              onChange={setStyle}
              options={STYLE_OPTIONS}
            />

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--border-default)]" />

            {/* Ratio */}
            <PillGroup options={ASPECT_RATIO_OPTIONS} value={aspectRatio} onChange={setAspectRatio} />

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--border-default)]" />

            {/* Count */}
            <PillGroup options={COUNT_OPTIONS} value={count} onChange={setCount} />
          </div>

          {/* Prompt row */}
          <div className="mt-2.5 flex items-stretch gap-2">
            {/* Photo upload — compact inline thumbnail */}
            {tab === "photo" && (
              <div className="w-[72px] flex-shrink-0">
                {photoPreview ? (
                  <div
                    className="group relative h-full w-full cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)]"
                    onClick={() => {
                      setPhoto(null);
                      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
                      photoPreviewRef.current = null;
                      setPhotoPreview(null);
                    }}
                  >
                    <img src={photoPreview} alt="Ref" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                  </div>
                ) : (
                  <UploadZone
                    onFile={handlePhotoSelect}
                    preview={null}
                    className="h-full min-h-0 !rounded-[var(--radius-md)] !border-[var(--border-default)] !p-1.5 [&_p]:!text-[8px] [&_svg]:!h-4 [&_svg]:!w-4"
                  />
                )}
              </div>
            )}

            {/* Prompt + Generate */}
            <div className="relative flex-1">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tab === "photo" ? "Style, clothing, mood, setting..." : "Describe your character in detail..."}
                rows={1}
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 pr-32 text-[var(--text-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)]"
                style={{ minHeight: "38px", maxHeight: "80px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !generating) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "38px";
                  el.style.height = Math.min(el.scrollHeight, 80) + "px";
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-3 py-1.5 text-[12px] font-bold text-[var(--bg-deep)] transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)]" />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <span>Generate</span>
                    <span className="flex items-center gap-0.5 rounded bg-[var(--bg-deep)]/15 px-1.5 py-0.5 text-[10px] font-bold">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                      {creditCost}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Save Modal ═══ */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => !saving && setShowSaveModal(false)}
        >
          <div
            className="relative w-full max-w-xs rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !saving && setShowSaveModal(false)}
              className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <h3 className="mb-4 text-center font-display text-base font-bold text-[var(--text-primary)]">
              Save Character
            </h3>

            {/* Image selector */}
            <div className="mb-4 flex justify-center">
              {generatedImages.length > 1 ? (
                <div className="flex gap-1.5">
                  {generatedImages.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSaveImage(i)}
                      className={`relative h-14 w-14 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150 ${
                        selectedSaveImage === i
                          ? "border-[var(--accent-amber)] shadow-[0_0_10px_rgba(232,166,52,0.25)]"
                          : "border-transparent opacity-50 hover:opacity-80"
                      }`}
                    >
                      <img src={src} alt={`${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : generatedImages[0] ? (
                <div className="h-28 w-28 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                  <img src={generatedImages[0]} alt="Character" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>

            {/* Large preview for multi-image */}
            {generatedImages.length > 1 && generatedImages[selectedSaveImage] && (
              <div className="mb-4 flex justify-center">
                <div className="h-36 w-36 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                  <img src={generatedImages[selectedSaveImage]} alt="Selected" className="h-full w-full object-cover" />
                </div>
              </div>
            )}

            {/* Name */}
            <input
              type="text"
              placeholder="Character name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) handleSave(); }}
              autoFocus
              className="mb-3 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-center text-[var(--text-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)]"
            />

            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-2 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
