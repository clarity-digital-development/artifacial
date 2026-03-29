"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDER_PROMPTS = [
  "A warrior queen standing on a cliff at sunset...",
  "A cyberpunk detective in neon-lit Tokyo streets...",
  "A mysterious stranger in a noir film scene...",
  "An astronaut exploring ancient ruins on Mars...",
  "A jazz musician in a smoky 1920s speakeasy...",
];

type GenState = "idle" | "generating" | "done" | "error";

export function QuickCreateBar() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [genState, setGenState] = useState<GenState>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_PROMPTS.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [prompt]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setGenState("generating");
    setResultUrl(null);
    setCharacterId(null);
    setErrorMsg(null);
    setShowSave(false);

    try {
      const formData = new FormData();
      formData.append("name", "Untitled Character");
      formData.append("style", "photorealistic");
      formData.append("mode", "description");
      formData.append("model", "gemini-3.1-flash-image-preview");
      formData.append("quality", "1k");
      formData.append("aspectRatio", "1:1");
      formData.append("count", "1");
      formData.append("description", trimmed);

      const res = await fetch("/api/characters/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      let gotImage = false;
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
            setResultUrl(data.url);
            setCharacterId(data.characterId ?? null);
            setGenState("done");
            gotImage = true;
          } else if (data.type === "error") {
            throw new Error(data.message || "Generation failed");
          }
        }
      }
      if (!gotImage) throw new Error("No image was generated");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setGenState("error");
    }
  };

  const handleSave = async () => {
    if (!saveName.trim() || saving || !characterId) return;
    setSaving(true);
    try {
      await fetch(`/api/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim() }),
      });
      router.push(`/characters/${characterId}`);
    } catch {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setGenState("idle");
    setResultUrl(null);
    setCharacterId(null);
    setErrorMsg(null);
    setShowSave(false);
    setSaveName("");
  };

  const isGenerating = genState === "generating";

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quick Generate</span>
      </div>

      {/* Input bar */}
      <div className="relative flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:border-[var(--accent-amber)] focus-within:shadow-[0_0_32px_rgba(232,166,52,0.1)]">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGenerate(); } }}
            disabled={isGenerating}
            className="w-full bg-transparent px-4 py-3.5 text-[var(--text-base)] text-[var(--text-primary)] placeholder-transparent outline-none lg:text-lg disabled:opacity-50"
            placeholder={PLACEHOLDER_PROMPTS[placeholderIndex]}
          />
          {!prompt && !isGenerating && (
            <span
              className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)] text-[var(--text-muted)] transition-opacity duration-300 lg:text-lg ${
                placeholderVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {PLACEHOLDER_PROMPTS[placeholderIndex]}
            </span>
          )}
          {isGenerating && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)] text-[var(--text-muted)] lg:text-lg">
              Generating…
            </span>
          )}
        </div>
        <button
          onClick={genState === "idle" || genState === "error" ? handleGenerate : genState === "done" ? handleReset : undefined}
          disabled={isGenerating || (!prompt.trim() && genState === "idle")}
          className="shrink-0 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--accent-amber-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating
            </span>
          ) : genState === "done" ? "New Image" : "Generate Image"}
        </button>
      </div>

      {/* Result area */}
      {genState === "error" && errorMsg && (
        <p className="mt-3 text-xs text-red-400">{errorMsg}</p>
      )}

      {(genState === "generating" || genState === "done") && (
        <div className="mt-4 flex items-start gap-5">
          {/* Image preview */}
          <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-input)]">
            {genState === "generating" ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-amber)] border-t-transparent" />
              </div>
            ) : resultUrl ? (
              <img src={resultUrl} alt="Generated" className="h-full w-full object-cover" />
            ) : null}
          </div>

          {/* Actions */}
          {genState === "done" && resultUrl && (
            <div className="flex flex-1 flex-col justify-center gap-3 py-1">
              {!showSave ? (
                <>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">{prompt}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSaveName(""); setShowSave(true); }}
                      className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
                    >
                      Save as Character
                    </button>
                    {characterId && (
                      <button
                        onClick={() => router.push(`/characters/${characterId}`)}
                        className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        View
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSave(false); }}
                    placeholder="Character name…"
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--accent-amber)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || saving}
                    className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)] disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition-all duration-200 hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
