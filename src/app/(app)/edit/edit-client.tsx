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
  { label: "1:1", value: "1:1" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" },
  { label: "3:4", value: "3:4" },
  { label: "4:3", value: "4:3" },
];

export function EditClient({
  characters,
  creditBalance,
}: {
  characters: Character[];
  creditBalance: number;
}) {
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
    <div className="flex min-h-0 flex-col gap-4 md:flex-row md:gap-5">
      {/* Left: Character strip (desktop only) */}
      <aside className="hidden w-[188px] shrink-0 flex-col gap-2 md:flex">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Characters
        </p>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {characters.map((char, idx) => (
            <button
              key={char.id}
              onClick={() => handleSelectChar(idx)}
              className={`group relative overflow-hidden rounded-[var(--radius-md)] border text-left transition-all duration-200 ${
                idx === selectedCharIdx
                  ? "border-[var(--accent-amber)] shadow-[0_0_12px_rgba(232,166,52,0.12)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
              }`}
            >
              <div className="aspect-[3/4] overflow-hidden bg-[var(--bg-input)]">
                {char.signedUrls[0] ? (
                  <img
                    src={char.signedUrls[0]}
                    alt={char.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-display text-2xl text-[var(--text-muted)]">
                      {char.name[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                  {char.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center + Right wrapper */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:gap-5">
        {/* Mobile: horizontal character selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          {characters.map((char, idx) => (
            <button
              key={char.id}
              onClick={() => handleSelectChar(idx)}
              className={`relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border transition-all ${
                idx === selectedCharIdx
                  ? "border-[var(--accent-amber)]"
                  : "border-[var(--border-subtle)]"
              }`}
            >
              {char.signedUrls[0] ? (
                <img
                  src={char.signedUrls[0]}
                  alt={char.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[var(--bg-input)]">
                  <span className="text-sm font-bold text-[var(--text-muted)]">
                    {char.name[0]}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-input)] md:min-h-[500px]">
          {isGenerating ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              {selectedImageUrl && (
                <img
                  src={selectedImageUrl}
                  alt="Processing"
                  className="absolute inset-0 h-full w-full object-contain opacity-30"
                />
              )}
              <div className="relative flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {genStatus === "submitting" ? "Submitting..." : "Editing image..."}
                </p>
              </div>
            </div>
          ) : isDone && resultUrl ? (
            <div className="flex h-full flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <img
                  src={resultUrl}
                  alt="Edit result"
                  className="h-full w-full object-contain"
                />
              </div>
              {/* Comparison strip */}
              <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-14 w-10 overflow-hidden rounded border border-[var(--border-subtle)] bg-[var(--bg-input)]">
                    {selectedImageUrl && (
                      <img src={selectedImageUrl} alt="Original" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)]">Original</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-14 w-10 overflow-hidden rounded border border-[var(--accent-amber)]/40 bg-[var(--bg-input)]">
                    <img src={resultUrl} alt="Result" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-[9px] text-[var(--accent-amber)]">Result</span>
                </div>
              </div>
            </div>
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

        {/* Right: Controls */}
        <aside className="flex w-full shrink-0 flex-col gap-4 md:w-[272px]">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to change... e.g. make the background a forest"
              rows={4}
              disabled={isGenerating}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-amber)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-amber)]/20 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Output Size
            </label>
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setImageSize(s.value)}
                  disabled={isGenerating}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    imageSize === s.value
                      ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                      : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            <span className="text-[var(--accent-amber)]">150 credits</span> · Balance:{" "}
            {creditBalance.toLocaleString()}
          </p>

          {isDone ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReset}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                Edit Again
              </button>
              <div className="border-t border-[var(--border-subtle)] pt-3">
                <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                  Save as Character
                </p>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Character name..."
                  className="mb-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-amber)]/50 focus:outline-none"
                />
                <button
                  onClick={handleSaveAsCharacter}
                  disabled={!saveName.trim() || saving}
                  className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-deep)] transition-colors disabled:opacity-50 hover:bg-[var(--accent-amber-dim)]"
                >
                  {saving ? "Saving..." : "Save as Character"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedImageKey || !prompt.trim()}
              className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {genStatus === "submitting"
                ? "Submitting..."
                : genStatus === "processing"
                ? "Editing..."
                : "Edit Image"}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
