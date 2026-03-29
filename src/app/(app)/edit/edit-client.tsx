"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export function EditClient({ characters }: { characters: Character[] }) {
  const router = useRouter();
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState("auto");
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedChar = characters[selectedCharIdx] ?? null;
  const selectedImageUrl = selectedChar?.signedUrls[0] ?? null;
  const selectedImageKey = selectedChar?.referenceImages[0] ?? null;

  useEffect(() => {
    if (!generationId || genStatus !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${generationId}/status`);
        const data = await res.json() as { status?: string; outputUrl?: string; errorMessage?: string };

        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          setResultUrl(data.outputUrl ?? null);
          setGenStatus("done");
        } else if (data.status === "FAILED" || data.status === "BLOCKED") {
          clearInterval(pollRef.current!);
          setErrorMsg(data.errorMessage ?? "Generation failed");
          setGenStatus("error");
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [generationId, genStatus]);

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
        }),
      });

      const data = await res.json() as { generationId?: string; error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to start generation");
        setGenStatus("error");
        return;
      }

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
      if (res.ok && data.characterId) {
        router.push(`/characters/${data.characterId}`);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  function handleSelectChar(idx: number) {
    setSelectedCharIdx(idx);
    setGenStatus("idle");
    setGenerationId(null);
    setResultUrl(null);
    setErrorMsg(null);
    setSaveName("");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function handleReset() {
    setGenStatus("idle");
    setGenerationId(null);
    setResultUrl(null);
    setErrorMsg(null);
    setSaveName("");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  const isGenerating = genStatus === "submitting" || genStatus === "processing";
  const isDone = genStatus === "done";

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">No characters yet</h2>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
          Create a character first, then come back to edit their images.
        </p>
        <Link
          href="/characters/new"
          className="mt-6 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
        >
          Create Character
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 120px)" }}>
      {/* Left: narrow scrollable thumbnail strip */}
      <div className="flex w-14 shrink-0 flex-col gap-1.5 overflow-y-auto">
        {characters.map((char, idx) => (
          <button
            key={char.id}
            onClick={() => handleSelectChar(idx)}
            title={char.name}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150 ${
              idx === selectedCharIdx
                ? "border-[var(--accent-amber)] shadow-[0_0_8px_rgba(232,166,52,0.3)]"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {char.signedUrls[0] ? (
              <img
                src={char.signedUrls[0]}
                alt={char.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--bg-input)]">
                <span className="text-xs font-bold text-[var(--text-muted)]">{char.name[0]}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Main column: canvas + bottom bar */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Canvas */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-input)]">
          {isGenerating ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              {selectedImageUrl && (
                <img
                  src={selectedImageUrl}
                  alt="Processing"
                  className="absolute inset-0 h-full w-full object-contain opacity-25"
                />
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
              src={resultUrl}
              alt="Edit result"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="relative flex h-full items-center justify-center">
              {selectedImageUrl ? (
                <img
                  src={selectedImageUrl}
                  alt={selectedChar?.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Select a character</p>
              )}
              {genStatus === "error" && errorMsg && (
                <div className="absolute bottom-4 left-4 right-4 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {errorMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparison strip (shown after generation) */}
        {isDone && resultUrl && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-12 w-9 overflow-hidden rounded border border-[var(--border-subtle)] bg-[var(--bg-input)]">
                {selectedImageUrl && (
                  <img src={selectedImageUrl} alt="Original" className="h-full w-full object-cover" />
                )}
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">Original</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="flex flex-col items-center gap-1">
              <div className="h-12 w-9 overflow-hidden rounded border border-[var(--accent-amber)]/50 bg-[var(--bg-input)]">
                <img src={resultUrl} alt="Result" className="h-full w-full object-cover" />
              </div>
              <span className="text-[9px] text-[var(--accent-amber)]">Result</span>
            </div>

            {/* Save as character — inline after result */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleReset}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
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

        {/* Bottom bar: prompt + size + generate */}
        {!isDone && (
          <div className="flex items-end gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to change… e.g. make the background a forest"
              rows={2}
              disabled={isGenerating}
              className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-amber)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)]/20 disabled:opacity-50"
            />
            <div className="flex shrink-0 flex-col gap-2">
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                disabled={isGenerating}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--accent-amber)]/50 focus:outline-none disabled:opacity-50"
              >
                {IMAGE_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedImageKey || !prompt.trim()}
                className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.12)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating
                  ? genStatus === "submitting" ? "Submitting…" : "Generating…"
                  : "Generate · 150cr"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
