"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";

type Character = {
  id: string;
  name: string;
  signedUrls: string[];
  referenceImages: string[];
};

type GenStatus = "idle" | "submitting" | "processing" | "done" | "error";

const IMAGE_SIZES = [
  { label: "Auto", value: "auto" },
  { label: "1:1 Square", value: "1:1" },
  { label: "9:16 Portrait", value: "9:16" },
  { label: "16:9 Landscape", value: "16:9" },
  { label: "3:4 Portrait", value: "3:4" },
  { label: "4:3 Landscape", value: "4:3" },
  { label: "2:3", value: "2:3" },
  { label: "3:2", value: "3:2" },
  { label: "4:5", value: "4:5" },
  { label: "5:4", value: "5:4" },
  { label: "21:9 Ultrawide", value: "21:9" },
];

// ─── Styled dropdown matching site design ───
function SizeDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = IMAGE_SIZES.find((s) => s.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-all duration-150 hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
      >
        <span>{selected?.label ?? value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-1.5 min-w-[172px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {IMAGE_SIZES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-center px-3.5 py-2 text-left text-[12px] font-medium transition-colors duration-100 ${
                opt.value === value
                  ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
              {opt.value === value && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-2 shrink-0">
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

// ─── Compact reference image uploader ───
function ReferenceImagePicker({
  preview,
  onFile,
  onClear,
  disabled,
}: {
  preview: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (preview) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--accent-amber)]/50">
        <img src={preview} alt="Reference" className="h-full w-full object-cover" />
        <button
          onClick={onClear}
          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        title="Add reference image"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] text-[var(--text-muted)] transition-all hover:border-[var(--accent-amber)]/50 hover:text-[var(--accent-amber)] disabled:opacity-40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
          <line x1="12" y1="9" x2="12" y2="15" /><line x1="9" y1="12" x2="15" y2="12" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

async function uploadFileToR2(file: File): Promise<{ key: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<{ key: string; url: string }>;
}

export function EditClient({ characters }: { characters: Character[] }) {
  const router = useRouter();
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState("auto");
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultR2Key, setResultR2Key] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refSignedUrl, setRefSignedUrl] = useState<string | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // For "edit again" — override the source image with a previous result
  const [overrideImageUrl, setOverrideImageUrl] = useState<string | null>(null);
  const [overrideImageKey, setOverrideImageKey] = useState<string | null>(null);
  // Toggle canvas between original and result for comparison
  const [canvasView, setCanvasView] = useState<"original" | "result">("result");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const selectedChar = characters[selectedCharIdx] ?? null;
  const baseImageUrl = overrideImageUrl ?? selectedChar?.signedUrls[0] ?? null;
  const baseImageKey = overrideImageKey ?? selectedChar?.referenceImages[0] ?? null;
  // Alias for clarity — these are what actually get submitted
  const selectedImageUrl = baseImageUrl;
  const selectedImageKey = baseImageKey;

  useEffect(() => {
    if (!generationId || genStatus !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${generationId}/status`);
        const data = await res.json() as { status?: string; outputUrl?: string; outputR2Key?: string; errorMessage?: string };
        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          setResultUrl(data.outputUrl ?? null);
          setResultR2Key(data.outputR2Key ?? null);
          setCanvasView("result");
          setGenStatus("done");
        } else if (data.status === "FAILED" || data.status === "BLOCKED") {
          clearInterval(pollRef.current!);
          setErrorMsg(data.errorMessage ?? "Generation failed");
          setGenStatus("error");
        }
      } catch {
        // keep polling
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [generationId, genStatus]);

  const handleRefFile = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setRefPreview(objectUrl);
    setRefUploading(true);
    try {
      const { url } = await uploadFileToR2(file);
      setRefSignedUrl(url);
    } catch {
      setRefPreview(null);
      setRefSignedUrl(null);
    } finally {
      setRefUploading(false);
    }
  }, []);

  function clearRef() {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefPreview(null);
    setRefSignedUrl(null);
  }

  async function handleGenerate() {
    if (!selectedImageKey || !prompt.trim()) return;
    setGenStatus("submitting");
    setErrorMsg(null);
    setResultUrl(null);
    setSaveName("");

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageR2Key: selectedImageKey,
          prompt: prompt.trim(),
          imageSize,
          characterId: selectedChar?.id,
          referenceImageUrl: refSignedUrl ?? undefined,
        }),
      });

      const data = await res.json() as { generationId?: string; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to start generation"); setGenStatus("error"); return; }
      setGenerationId(data.generationId!);
      setGenStatus("processing");
    } catch {
      setErrorMsg("Network error — please try again");
      setGenStatus("error");
    }
  }

  async function handleSaveAsCharacter() {
    if (!generationId || !saveName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/edit/${generationId}/save-as-character`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName }),
      });
      const data = await res.json() as { characterId?: string };
      if (res.ok && data.characterId) router.push(`/characters/${data.characterId}`);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  function handleSelectChar(idx: number) {
    if (idx === selectedCharIdx) return;
    setSelectedCharIdx(idx);
    setOverrideImageUrl(null);
    setOverrideImageKey(null);
    setGenStatus("idle");
    setGenerationId(null);
    setResultUrl(null);
    setResultR2Key(null);
    setErrorMsg(null);
    setSaveName("");
    setCanvasView("result");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  // "Edit again" — use result as new source image so edits build on the result
  function handleEditAgain(newImageUrl: string, newImageKey: string) {
    setOverrideImageUrl(newImageUrl);
    setOverrideImageKey(newImageKey);
    setGenStatus("idle");
    setGenerationId(null);
    setResultUrl(null);
    setResultR2Key(null);
    setErrorMsg(null);
    setSaveName("");
    setCanvasView("result");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  const isGenerating = genStatus === "submitting" || genStatus === "processing";
  const isDone = genStatus === "done";

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">No characters yet</h2>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">Create a character first to edit their images.</p>
        <Link href="/characters/new" className="mt-6 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]">
          Create Character
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 120px)" }}>
      {/* Left: narrow scrollable thumbnail strip — no scrollbar */}
      <div className="scrollbar-hide flex w-14 shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
        {characters.map((char, idx) => (
          <button
            key={char.id}
            onClick={() => handleSelectChar(idx)}
            title={char.name}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150 ${
              idx === selectedCharIdx
                ? "border-[var(--accent-amber)] shadow-[0_0_8px_rgba(232,166,52,0.3)]"
                : "border-transparent opacity-50 hover:opacity-90"
            }`}
          >
            {char.signedUrls[0] ? (
              <img src={char.signedUrls[0]} alt={char.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--bg-input)]">
                <span className="text-xs font-bold text-[var(--text-muted)]">{char.name[0]}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Canvas — dark bg with subtle amber grid, no border */}
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)]"
          style={{
            backgroundColor: "var(--bg-deep)",
            backgroundImage: "linear-gradient(rgba(232,166,52,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(232,166,52,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          {isGenerating ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              {selectedImageUrl && (
                <img src={selectedImageUrl} alt="Processing" className="absolute inset-0 h-full w-full object-contain opacity-20" />
              )}
              <div className="relative flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {genStatus === "submitting" ? "Submitting…" : "Editing image…"}
                </p>
              </div>
            </div>
          ) : isDone && resultUrl ? (
            <img
              src={canvasView === "original" ? (selectedImageUrl ?? resultUrl) : resultUrl}
              alt={canvasView === "original" ? "Original" : "Edit result"}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="relative flex h-full items-center justify-center">
              {selectedImageUrl
                ? <img src={selectedImageUrl} alt={selectedChar?.name} className="h-full w-full object-contain" />
                : <p className="text-sm text-[var(--text-muted)]">Select a character</p>
              }
              {genStatus === "error" && errorMsg && (
                <div className="absolute bottom-4 left-4 right-4 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {errorMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparison strip (after generation) */}
        {isDone && resultUrl && (
          <div className="flex items-center gap-3">
            {/* Original thumbnail — click to preview in canvas */}
            <button
              onClick={() => setCanvasView("original")}
              className={`flex flex-col items-center gap-1 transition-opacity ${canvasView === "original" ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
            >
              <div className={`h-12 w-9 overflow-hidden rounded border-2 bg-[var(--bg-input)] transition-colors ${canvasView === "original" ? "border-[var(--text-secondary)]" : "border-transparent"}`}>
                {selectedImageUrl && <img src={selectedImageUrl} alt="Original" className="h-full w-full object-cover" />}
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">Original</span>
            </button>

            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
              <polyline points="9 18 15 12 9 6" />
            </svg>

            {/* Result thumbnail — click to preview in canvas */}
            <button
              onClick={() => setCanvasView("result")}
              className={`flex flex-col items-center gap-1 transition-opacity ${canvasView === "result" ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
            >
              <div className={`h-12 w-9 overflow-hidden rounded border-2 bg-[var(--bg-input)] transition-colors ${canvasView === "result" ? "border-[var(--accent-amber)]" : "border-transparent"}`}>
                <img src={resultUrl} alt="Result" className="h-full w-full object-cover" />
              </div>
              <span className={`text-[9px] ${canvasView === "result" ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"}`}>Result</span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => resultR2Key && resultUrl ? handleEditAgain(resultUrl, resultR2Key) : null}
                disabled={!resultR2Key}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                Edit again
              </button>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Character name…"
                className="w-36 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-amber)]/50 focus:outline-none"
              />
              <button
                onClick={handleSaveAsCharacter}
                disabled={!saveName.trim() || saving}
                className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-deep)] transition-colors disabled:opacity-50 hover:bg-[var(--accent-amber-dim)]"
              >
                {saving ? "Saving…" : "Save as Character"}
              </button>
            </div>
          </div>
        )}

        {/* Desktop bottom bar (hidden on mobile) */}
        {!isDone && (
          <div className="hidden justify-center md:flex">
            <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-4 py-3 shadow-[0_-4px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              {/* Controls row */}
              <div className="mb-2.5 flex items-center gap-2">
                <SizeDropdown value={imageSize} onChange={setImageSize} disabled={isGenerating} />
              </div>

              {/* Prompt row */}
              <div className="relative">
                {/* Reference image — absolute left */}
                <div className="absolute left-2.5 top-2.5 z-10">
                  <ReferenceImagePicker
                    preview={refPreview}
                    onFile={handleRefFile}
                    onClear={clearRef}
                    disabled={isGenerating || refUploading}
                  />
                </div>

                {/* Textarea */}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={refUploading ? "Uploading reference…" : "Describe what to change… e.g. make the background a forest"}
                  rows={2}
                  disabled={isGenerating}
                  className={`w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-3 pr-44 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)] disabled:opacity-50 ${refPreview ? "pl-14" : "pl-12"}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />

                {/* Generate button — absolute right */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedImageKey || !prompt.trim() || refUploading}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-xl bg-[var(--accent-amber)] px-5 py-2.5 text-[13px] font-bold text-[var(--bg-deep)] transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)]" />
                      <span>{genStatus === "submitting" ? "Submitting" : "Generating"}</span>
                    </>
                  ) : (
                    <>
                      <span>Generate</span>
                      <span className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-deep)]/15 px-1.5 py-0.5 text-[10px] font-bold">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        150
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile: fixed bottom button ── */}
      {!isDone && (
        <div className="no-stagger fixed bottom-16 left-0 right-0 z-40 px-4 pb-[env(safe-area-inset-bottom)] md:hidden">
          <button
            onClick={() => setSheetOpen(true)}
            disabled={isGenerating}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--accent-amber)] text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.2)] transition-all duration-200 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Edit Image
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Mobile: edit sheet ── */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSheetOpen(false)}
            className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 md:hidden ${
              sheetOpen ? "opacity-50 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          />
          {/* Sheet */}
          <div
            className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-transform duration-300 md:hidden ${
              sheetOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
            }`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="space-y-4 px-4 pb-24">
              {/* Prompt */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Prompt</label>
                <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 focus-within:border-[var(--accent-amber)]/40">
                  <ReferenceImagePicker
                    preview={refPreview}
                    onFile={handleRefFile}
                    onClear={clearRef}
                    disabled={isGenerating || refUploading}
                  />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={refUploading ? "Uploading reference…" : "Describe what to change…"}
                    rows={4}
                    disabled={isGenerating}
                    className="min-h-0 flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Output Size</label>
                <SizeDropdown value={imageSize} onChange={setImageSize} disabled={isGenerating} />
              </div>

              {/* Generate */}
              <button
                onClick={() => { handleGenerate(); setSheetOpen(false); }}
                disabled={isGenerating || !selectedImageKey || !prompt.trim() || refUploading}
                className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:opacity-50"
              >
                Generate · 150cr
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
