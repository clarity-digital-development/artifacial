"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";

// ─── Types ───

interface ProjectData {
  id: string;
  name: string;
  status: string;
  characterId: string | null;
  characterName: string | null;
  characterThumbnail: string | null;
  videoUrl: string | null;
  prompt: string | null;
}

interface CharacterOption {
  id: string;
  name: string;
  style: string;
}

const STATUS_VARIANT: Record<string, "default" | "amber" | "success" | "error"> = {
  draft: "default",
  generating: "amber",
  complete: "success",
  failed: "error",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  complete: "Complete",
  failed: "Failed",
};

const POLL_INTERVAL = 4000;

// ─── Main Component ───

export function SceneBuilderClient({
  project: initialProject,
  characters,
}: {
  project: ProjectData;
  characters: CharacterOption[];
}) {
  const router = useRouter();
  const projectId = initialProject.id; // Stable ref — never changes for this page
  const [project, setProject] = useState(initialProject);
  const [prompt, setPrompt] = useState(initialProject.prompt ?? "");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project.name);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [generating, setGenerating] = useState(initialProject.status === "generating");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ─── Status Polling ───

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/status`);
      if (!res.ok) return;

      const data = await res.json();

      if (data.status === "complete") {
        stopPolling();
        setGenerating(false);
        setProject((p) => ({
          ...p,
          status: "complete",
          videoUrl: data.videoUrl,
        }));
      } else if (data.status === "failed") {
        stopPolling();
        setGenerating(false);
        setError(data.error ?? "Generation failed");
        setProject((p) => ({ ...p, status: "failed" }));
      }
    } catch {
      // Silently retry on network error
    }
  }, [projectId, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
  }, [pollStatus, stopPolling]);

  // Start polling if page loads in generating state
  useEffect(() => {
    if (generating) startPolling();
    return stopPolling;
  }, [generating, startPolling, stopPolling]);

  // Close character picker on outside click
  useEffect(() => {
    if (!showCharacterPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCharacterPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCharacterPicker]);

  // ─── Project Actions ───

  const saveName = async () => {
    setEditingName(false);
    if (nameValue.trim() === project.name) return;
    const name = nameValue.trim() || "Untitled Project";
    setProject((p) => ({ ...p, name }));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  };

  const changeCharacter = async (characterId: string | null) => {
    setShowCharacterPicker(false);
    const char = characters.find((c) => c.id === characterId);
    setProject((p) => ({
      ...p,
      characterId,
      characterName: char?.name ?? null,
      characterThumbnail: null,
    }));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setProject((p) => ({ ...p, status: "generating" }));

    try {
      const res = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "insufficient_credits") {
          setError(`Not enough video credits (need ${data.required}, have ${data.available})`);
        } else {
          setError(data.error ?? "Failed to start generation");
        }
        setGenerating(false);
        setProject((p) => ({ ...p, status: "draft" }));
        return;
      }

      // Job queued — start polling
      startPolling();
    } catch {
      setError("Network error — please try again");
      setGenerating(false);
      setProject((p) => ({ ...p, status: "draft" }));
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/projects");
    } catch {
      setDeleting(false);
    }
  };

  // ─── Render ───

  return (
    <div className="flex flex-col gap-8">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="bg-transparent font-display text-2xl font-bold text-[var(--text-primary)] outline-none border-b border-[var(--accent-amber)]"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setEditingName(true);
                setTimeout(() => nameInputRef.current?.focus(), 0);
              }}
              className="font-display text-2xl font-bold text-[var(--text-primary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--accent-amber)]"
            >
              {project.name}
            </button>
          )}
          <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>
            {STATUS_LABEL[project.status] ?? project.status}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Character selector */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowCharacterPicker(!showCharacterPicker)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-sm)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--border-default)]"
            >
              {project.characterThumbnail ? (
                <img
                  src={project.characterThumbnail}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-xs)] text-[var(--text-muted)]">
                  {project.characterName?.[0] ?? "?"}
                </div>
              )}
              <span className="text-[var(--text-secondary)]">
                {project.characterName ?? "No character"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCharacterPicker && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <button
                  onClick={() => changeCharacter(null)}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--text-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)]"
                >
                  None
                </button>
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => changeCharacter(c.id)}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--text-sm)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--bg-elevated)] ${
                      c.id === project.characterId
                        ? "text-[var(--accent-amber)]"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {c.name}
                    <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                      {c.style}
                    </span>
                  </button>
                ))}
                {characters.length === 0 && (
                  <p className="px-3 py-2 text-[var(--text-xs)] text-[var(--text-muted)]">
                    No characters yet
                  </p>
                )}
              </div>
            )}
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      {/* Video Preview */}
      <div className="relative mx-auto flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-deep)] shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]">
        {project.videoUrl ? (
          <video
            src={project.videoUrl}
            controls
            loop
            className="h-full w-full rounded-[var(--radius-lg)] object-contain"
          />
        ) : generating ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--accent-amber)]" />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-[var(--accent-amber)]/40" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <div className="text-center">
              <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Generating your video
              </p>
              <p className="mt-1 text-[var(--text-xs)] text-[var(--text-muted)]">
                This usually takes 1–3 minutes
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--accent-amber)]/40">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span className="text-[var(--text-sm)]">
              Describe your video below and generate
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-auto w-full max-w-3xl rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-[var(--text-sm)] text-red-400">{error}</p>
        </div>
      )}

      {/* Prompt + Generate */}
      <div className="mx-auto w-full max-w-3xl">
        <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
          Video Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your video in detail — action, movement, environment, mood..."
          rows={4}
          disabled={generating}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[var(--accent-amber)] focus:shadow-[0_0_0_2px_var(--accent-amber-glow)] disabled:opacity-50"
        />

        <div className="mt-4 flex items-center gap-4">
          <Button
            fullWidth
            size="lg"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
          >
            {generating
              ? "Generating..."
              : project.videoUrl
                ? "Regenerate Video"
                : "Generate Video"}
          </Button>
        </div>
      </div>
    </div>
  );
}
