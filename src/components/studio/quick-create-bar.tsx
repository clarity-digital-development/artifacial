"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const PLACEHOLDER_PROMPTS = [
  "A warrior queen standing on a cliff at sunset...",
  "Me as a cyberpunk detective in neon-lit Tokyo...",
  "A mysterious stranger in a noir film scene...",
  "An astronaut exploring ancient ruins on Mars...",
  "A jazz musician in a smoky 1920s speakeasy...",
];

export function QuickCreateBar() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
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

  const handleCreateCharacter = () => {
    if (!prompt.trim()) {
      router.push("/characters/new");
      return;
    }
    const params = new URLSearchParams({
      prompt: prompt.trim(),
      tab: "description",
    });
    router.push(`/characters/new?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateCharacter();
    }
  };

  return (
    <div className="group relative">
      <div className="relative flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:border-[var(--accent-amber)] focus-within:shadow-[0_0_24px_rgba(232,166,52,0.12)]">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent px-4 py-3 text-[var(--text-lg)] text-[var(--text-primary)] placeholder-transparent outline-none"
            placeholder={PLACEHOLDER_PROMPTS[placeholderIndex]}
          />
          {!prompt && (
            <span
              className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-lg)] text-[var(--text-muted)] transition-opacity duration-300 ${
                placeholderVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {PLACEHOLDER_PROMPTS[placeholderIndex]}
            </span>
          )}
        </div>
        <Button size="md" className="shrink-0" onClick={handleCreateCharacter}>
          Create Character
        </Button>
      </div>
    </div>
  );
}
