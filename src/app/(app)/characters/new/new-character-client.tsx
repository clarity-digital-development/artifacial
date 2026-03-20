"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CharacterPreviewGrid } from "@/components/character-preview-grid";

const STYLE_OPTIONS = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "cinematic", label: "Cinematic" },
  { value: "stylized", label: "Stylized" },
  { value: "anime", label: "Anime" },
];

type ModelOption = { value: string; label: string; cost: number; tier: "budget" | "standard" | "ultra" };

const SFW_MODEL_OPTIONS: ModelOption[] = [
  // Budget (10 cr/image)
  { value: "flux-2-pro", label: "Flux 2 Pro", cost: 10, tier: "budget" },
  { value: "recraft-v3", label: "Recraft V3", cost: 10, tier: "budget" },
  // Standard (15 cr/image)
  { value: "gemini-2.5-flash-preview-05-20", label: "Nano Banana Flash", cost: 15, tier: "standard" },
  { value: "ideogram-v3", label: "Ideogram V3", cost: 15, tier: "standard" },
  // Ultra (25 cr/image)
  { value: "gemini-2.5-pro-preview-06-05", label: "Nano Banana Pro", cost: 25, tier: "ultra" },
];

const NSFW_MODEL_OPTIONS: ModelOption[] = [
  // Budget (1 cr/image)
  { value: "chroma-hd", label: "CHROMA HD", cost: 1, tier: "budget" },
  // Standard (1 cr/image)
  { value: "juggernaut-xl", label: "Juggernaut XL Ragnarok", cost: 1, tier: "standard" },
];

const TIER_COLORS: Record<string, string> = {
  budget: "text-emerald-400",
  standard: "text-[var(--accent-amber)]",
  ultra: "text-purple-400",
};

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

const COUNT_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
];

/* ── Custom Dropdown ── */
function Dropdown({
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-all duration-150 hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
      >
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
        <span>{selected?.label ?? value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-0.5 text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[180px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3.5 py-2 text-left text-[12px] font-medium transition-colors duration-100 ${
                opt.value === value
                  ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
              {opt.value === value && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-2 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span className={opt.value === value ? "" : "ml-[18px]"}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Model Dropdown with tier badges ── */
function ModelDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ModelOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const tierLabel = selected?.tier ? selected.tier.charAt(0).toUpperCase() + selected.tier.slice(1) : "";

  // Group by tier
  const tiers = ["budget", "standard", "ultra"] as const;
  const groups = tiers
    .map((t) => ({ tier: t, models: options.filter((o) => o.tier === t) }))
    .filter((g) => g.models.length > 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-all duration-150 hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        <span>{selected?.label ?? value}</span>
        {selected && (
          <span className={`text-[9px] font-bold uppercase ${TIER_COLORS[selected.tier]}`}>
            {tierLabel}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-0.5 text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[220px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {groups.map((group) => (
            <div key={group.tier}>
              <div className="px-3.5 pb-0.5 pt-2">
                <p className={`text-[9px] font-bold uppercase tracking-wider ${TIER_COLORS[group.tier]}`}>
                  {group.tier} ({group.models[0].cost} cr/img)
                </p>
              </div>
              {group.models.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[12px] font-medium transition-colors duration-100 ${
                    opt.value === value
                      ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className={opt.value === value ? "" : ""}>{opt.label}</span>
                  {opt.value === value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pill Group ── */
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
    <div className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
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

export function NewCharacterClient({ contentMode = "SFW" }: { contentMode?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const isNsfw = contentMode === "NSFW";
  const MODEL_OPTIONS = isNsfw ? NSFW_MODEL_OPTIONS : SFW_MODEL_OPTIONS;
  const defaultModel = isNsfw ? "juggernaut-xl" : "gemini-2.5-pro-preview-06-05";

  const [description, setDescription] = useState(initialPrompt);
  const [style, setStyle] = useState("photorealistic");
  const [model, setModel] = useState(defaultModel);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [count, setCount] = useState("4");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [error, setError] = useState<string | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSaveImage, setSelectedSaveImage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatedCharacterId, setGeneratedCharacterId] = useState<string | null>(null);

  const photoPreviewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelCost = MODEL_OPTIONS.find((m) => m.value === model)?.cost ?? 10;
  const creditCost = parseInt(count) * modelCost;

  const hasImages = images.some((img) => img !== null);
  const generatedImages = images.filter(Boolean) as string[];
  const mode = photo ? "photo" : "description";

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

  const removePhoto = useCallback(() => {
    setPhoto(null);
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    photoPreviewRef.current = null;
    setPhotoPreview(null);
  }, []);

  const handleGenerate = async () => {
    if (mode === "photo" && !photo) {
      setError("Upload a reference photo");
      return;
    }
    if (mode === "description" && !description.trim()) {
      setError("Describe your character");
      return;
    }

    setError(null);
    setGenerating(true);
    setGeneratedCharacterId(null);
    const n = parseInt(count);
    setImages(Array(n).fill(null));

    try {
      const formData = new FormData();
      formData.append("name", description.trim().slice(0, 40) || "Character");
      formData.append("style", style);
      formData.append("mode", mode);
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
            if (data.characterId) setGeneratedCharacterId(data.characterId);
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
      if (generatedCharacterId) {
        // Update the character that was already created during generation
        const res = await fetch(`/api/characters/${generatedCharacterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: saveName.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save character");
        router.push(`/characters/${generatedCharacterId}`);
      } else {
        // Fallback: create new character if no generation was done
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
      }
    } catch {
      setError("Failed to save character");
      setSaving(false);
      setShowSaveModal(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ═══ Canvas ═══ */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8 py-6">
        {hasImages || generating ? (
          <div className="w-full max-w-4xl">
            <CharacterPreviewGrid images={images} generating={generating} />
            {hasImages && !generating && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/80 px-4 py-1.5 text-[var(--text-xs)] font-medium text-[var(--text-secondary)] backdrop-blur-sm transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Redo
                </button>
                <button
                  onClick={handleOpenSave}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--accent-amber)] px-4 py-1.5 text-[var(--text-xs)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  Save Character
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-[var(--text-muted)]">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* ═══ Floating Toolbar ═══ */}
      <div className="relative z-10 flex justify-center pb-5 pt-2">
        {error && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-red-500/20 bg-red-950/90 px-4 py-1.5 text-[var(--text-xs)] text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-4 py-3 shadow-[0_-4px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          {/* Controls row */}
          <div className="mb-2.5 flex items-center gap-2">
            <ModelDropdown
              value={model}
              onChange={setModel}
              options={MODEL_OPTIONS}
            />
            <Dropdown value={style} onChange={setStyle} options={STYLE_OPTIONS} />
            <div className="h-4 w-px bg-[var(--border-default)]" />
            <Dropdown value={aspectRatio} onChange={setAspectRatio} options={ASPECT_RATIO_OPTIONS} />
            <div className="h-4 w-px bg-[var(--border-default)]" />
            <PillGroup options={COUNT_OPTIONS} value={count} onChange={setCount} />
          </div>

          {/* Prompt row */}
          <div className="relative">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoSelect(file);
                e.target.value = "";
              }}
            />

            {/* Photo thumbnail or add-image button — top-left of textarea */}
            {photoPreview ? (
              <div className="absolute left-2.5 top-2.5 z-10">
                <div className="group relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg">
                  <img src={photoPreview} alt="Ref" className="h-full w-full object-cover" />
                  <button
                    onClick={removePhoto}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-2.5 top-2.5 z-10 flex items-center gap-0.5 rounded-lg px-1 py-1 text-[var(--accent-amber)] transition-colors hover:bg-[var(--accent-amber)]/10 hover:text-[var(--accent-amber)]"
                title="Add reference image"
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}

            {/* Textarea */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={photo ? "Style, clothing, mood, setting..." : "Describe your character in detail..."}
              rows={2}
              className={`w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-3 pr-40 text-[var(--text-sm)] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)] ${photoPreview ? "pl-14" : "pl-12"}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !generating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />

            {/* Generate button — vertically centered right */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-xl bg-[var(--accent-amber)] px-5 py-2.5 text-[13px] font-bold text-[var(--bg-deep)] transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)]" />
                  <span>Generating</span>
                </>
              ) : (
                <>
                  <span>Generate</span>
                  <span className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-deep)]/15 px-1.5 py-0.5 text-[10px] font-bold">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                    {creditCost}
                  </span>
                </>
              )}
            </button>
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
            className="relative w-full max-w-xs rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !saving && setShowSaveModal(false)}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <h3 className="mb-4 text-center font-display text-base font-bold text-[var(--text-primary)]">
              Save Character
            </h3>

            <div className="mb-4 flex justify-center">
              {generatedImages.length > 1 ? (
                <div className="flex gap-1.5">
                  {generatedImages.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSaveImage(i)}
                      className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 transition-all duration-150 ${
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
                <div className="h-28 w-28 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  <img src={generatedImages[0]} alt="Character" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>

            {generatedImages.length > 1 && generatedImages[selectedSaveImage] && (
              <div className="mb-4 flex justify-center">
                <div className="h-36 w-36 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  <img src={generatedImages[selectedSaveImage]} alt="Selected" className="h-full w-full object-cover" />
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="Character name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) handleSave(); }}
              autoFocus
              className="mb-3 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-center text-[var(--text-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)]"
            />

            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="w-full rounded-xl bg-[var(--accent-amber)] py-2.5 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
