"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { UploadZone } from "@/components/upload-zone";

// ─── Types ───

interface ProjectData {
  id: string;
  name: string;
  mode: string;
  status: string;
  characterId: string | null;
  characterName: string | null;
  characterThumbnail: string | null;
  videoUrl: string | null;
  prompt: string | null;
  duration: string | null;
  aspectRatio: string | null;
}

interface CharacterOption {
  id: string;
  name: string;
  style: string;
  thumbnail: string | null;
}

interface HistoryItem {
  id: string;
  name: string;
  status: string;
  mode: string;
  prompt: string | null;
  duration: string | null;
  aspectRatio: string | null;
  characterName: string | null;
  videoUrl: string | null;
  createdAt: string;
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

const MODE_LABEL: Record<string, string> = {
  text2video: "Text to Video",
  faceswap: "Face Swap",
  image2video: "Image to Video",
};

const DURATION_OPTIONS = [
  { value: "5", label: "5s" },
  { value: "10", label: "10s" },
];

const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
];

const CREDIT_COST_VIDEO_5S = 200;
const CREDIT_COST_VIDEO_10S = 400;
const POLL_INTERVAL = 4000;

// ─── Main Component ───

export function SceneBuilderClient({
  project: initialProject,
  characters,
  history,
}: {
  project: ProjectData;
  characters: CharacterOption[];
  history: HistoryItem[];
}) {
  const router = useRouter();
  const projectId = initialProject.id;
  const [project, setProject] = useState(initialProject);
  const [mode, setMode] = useState(initialProject.mode || "text2video");
  const [prompt, setPrompt] = useState(initialProject.prompt ?? "");
  const [duration, setDuration] = useState(initialProject.duration ?? "5");
  const [aspectRatio, setAspectRatio] = useState(initialProject.aspectRatio ?? "16:9");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project.name);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [generating, setGenerating] = useState(initialProject.status === "generating");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which video is being viewed (null = current project, or a history item)
  const [viewingHistory, setViewingHistory] = useState<HistoryItem | null>(null);

  // Uploads
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);
  const [sourceVideoPreview, setSourceVideoPreview] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewRef.current) URL.revokeObjectURL(videoPreviewRef.current);
    };
  }, []);

  // ─── Credit calculation ───

  const creditCost = (() => {
    if (mode === "text2video" || mode === "image2video") {
      return duration === "10" ? CREDIT_COST_VIDEO_10S : CREDIT_COST_VIDEO_5S;
    }
    return CREDIT_COST_VIDEO_5S;
  })();

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
        setProject((p) => ({ ...p, status: "complete", videoUrl: data.videoUrl }));
      } else if (data.status === "failed") {
        stopPolling();
        setGenerating(false);
        setError(data.error ?? "Generation failed");
        setProject((p) => ({ ...p, status: "failed" }));
      }
    } catch {
      // Silently retry
    }
  }, [projectId, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
  }, [pollStatus, stopPolling]);

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
      characterThumbnail: char?.thumbnail ?? null,
    }));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
  };

  const handleVideoUpload = useCallback((file: File) => {
    setSourceVideo(file);
    if (videoPreviewRef.current) URL.revokeObjectURL(videoPreviewRef.current);
    const url = URL.createObjectURL(file);
    videoPreviewRef.current = url;
    setSourceVideoPreview(url);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    setSourceImage(file);
    const url = URL.createObjectURL(file);
    setSourceImagePreview(url);
  }, []);

  const handleGenerate = async () => {
    if (generating) return;

    if (mode === "text2video" && !prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    if (mode === "faceswap" && !sourceVideo) {
      setError("Please upload a video");
      return;
    }
    if (mode === "faceswap" && !project.characterId) {
      setError("Please select a character for face swap");
      return;
    }
    if (mode === "image2video" && !sourceImage && !project.characterId) {
      setError("Please upload an image or select a character");
      return;
    }

    setGenerating(true);
    setError(null);
    setViewingHistory(null);
    setProject((p) => ({ ...p, status: "generating" }));

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("duration", duration);
      formData.append("aspectRatio", aspectRatio);
      if (prompt.trim()) formData.append("prompt", prompt.trim());
      if (sourceVideo) formData.append("sourceVideo", sourceVideo);
      if (sourceImage) formData.append("sourceImage", sourceImage);

      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "insufficient_credits") {
          setError(`Not enough credits (need ${data.required}, have ${data.available})`);
        } else {
          setError(data.error ?? "Failed to start generation");
        }
        setGenerating(false);
        setProject((p) => ({ ...p, status: "draft" }));
        return;
      }

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

  const handleDownload = () => {
    const url = viewingHistory?.videoUrl ?? project.videoUrl;
    if (!url) return;
    const name = viewingHistory?.name ?? project.name;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-")}.mp4`;
    a.click();
  };

  const selectedChar = characters.find((c) => c.id === project.characterId);

  // Active video data (current project or history item)
  const activeVideoUrl = viewingHistory?.videoUrl ?? project.videoUrl;
  const activePrompt = viewingHistory?.prompt ?? project.prompt;
  const activeDuration = viewingHistory?.duration ?? project.duration;
  const activeAspectRatio = viewingHistory?.aspectRatio ?? project.aspectRatio;
  const activeMode = viewingHistory?.mode ?? project.mode;
  const activeName = viewingHistory?.name ?? project.name;
  const activeStatus = viewingHistory ? viewingHistory.status : project.status;
  const activeCharacterName = viewingHistory?.characterName ?? project.characterName;

  // ─── Render ───

  return (
    <div className="flex h-full">
      {/* ═══ LEFT: Static Input Panel ═══ */}
      <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-full bg-transparent font-display text-base font-bold text-[var(--text-primary)] outline-none border-b border-[var(--accent-amber)]"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingName(true);
                    setTimeout(() => nameInputRef.current?.focus(), 0);
                  }}
                  className="truncate font-display text-base font-bold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-amber)]"
                >
                  {project.name}
                </button>
              )}
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-shrink-0 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Delete project"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          {/* Character selector */}
          <div className="relative mb-4" ref={pickerRef}>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Character
            </span>
            <button
              onClick={() => setShowCharacterPicker(!showCharacterPicker)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 transition-all duration-200 hover:border-[var(--text-muted)]"
            >
              {project.characterThumbnail ? (
                <img src={project.characterThumbnail} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[9px] text-[var(--text-muted)]">
                  {project.characterName?.[0] ?? "?"}
                </div>
              )}
              <span className="flex-1 truncate text-left text-[var(--text-sm)] text-[var(--text-primary)]">
                {project.characterName ?? "Select character"}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCharacterPicker && (
              <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <button
                  onClick={() => changeCharacter(null)}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[var(--text-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  None
                </button>
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => changeCharacter(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[var(--text-sm)] hover:bg-[var(--bg-elevated)] ${
                      c.id === project.characterId ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {c.thumbnail ? (
                      <img src={c.thumbnail} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[9px] text-[var(--text-muted)]">
                        {c.name[0]}
                      </div>
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
                {characters.length === 0 && (
                  <p className="px-2.5 py-1.5 text-[var(--text-xs)] text-[var(--text-muted)]">No characters yet</p>
                )}
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="mb-4">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Mode
            </span>
            <div className="flex flex-col gap-1">
              {[
                { value: "text2video", label: "Text to Video", icon: "M4 5h16M4 12h10M4 19h16" },
                { value: "faceswap", label: "Face Swap", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
                { value: "image2video", label: "Animate Image", icon: "M5 3l14 9-14 9V3z" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[var(--text-sm)] font-medium transition-all duration-200 ${
                    mode === opt.value
                      ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={opt.icon} />
                  </svg>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific uploads */}
          {mode === "faceswap" && (
            <div className="mb-4">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Source Video
              </span>
              {sourceVideoPreview ? (
                <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                  <video src={sourceVideoPreview} className="w-full max-h-[140px] object-contain bg-black" controls muted />
                  <button
                    onClick={() => { setSourceVideo(null); setSourceVideoPreview(null); }}
                    className="absolute right-1.5 top-1.5 rounded-full bg-[var(--bg-deep)]/80 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <UploadZone onFile={handleVideoUpload} accept="video/mp4,video/quicktime,video/webm" className="min-h-[80px]" />
              )}
              {selectedChar && (
                <div className="mt-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                  {project.characterThumbnail ? (
                    <img src={project.characterThumbnail} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] text-xs">{selectedChar.name[0]}</div>
                  )}
                  <div>
                    <p className="text-[var(--text-xs)] font-medium text-[var(--text-primary)]">{selectedChar.name}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">Swap target</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "image2video" && (
            <div className="mb-4">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Source Image
              </span>
              {sourceImagePreview ? (
                <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                  <img src={sourceImagePreview} alt="Source" className="w-full max-h-[140px] object-contain bg-black" />
                  <button
                    onClick={() => { setSourceImage(null); setSourceImagePreview(null); }}
                    className="absolute right-1.5 top-1.5 rounded-full bg-[var(--bg-deep)]/80 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : project.characterThumbnail ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                    <img src={project.characterThumbnail} alt="" className="h-10 w-10 rounded-[var(--radius-sm)] object-cover" />
                    <div>
                      <p className="text-[var(--text-xs)] font-medium text-[var(--text-primary)]">Character ref</p>
                      <p className="text-[9px] text-[var(--text-muted)]">Or upload below</p>
                    </div>
                  </div>
                  <UploadZone onFile={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="min-h-[60px]" />
                </div>
              ) : (
                <UploadZone onFile={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="min-h-[80px]" />
              )}
            </div>
          )}

          {/* Duration + Aspect Ratio */}
          {(mode === "text2video" || mode === "image2video") && (
            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Duration
                </span>
                <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--text-xs)] font-medium transition-all duration-200 ${
                        duration === opt.value
                          ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Ratio
                </span>
                <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-0.5">
                  {ASPECT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
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
            </div>
          )}

          {/* Prompt */}
          <div className="mb-4">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {mode === "image2video" ? "Motion Prompt" : "Prompt"}
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "faceswap"
                  ? "Optional: describe the scene..."
                  : mode === "image2video"
                    ? "Describe the motion..."
                    : "Describe your video in detail..."
              }
              rows={4}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-[var(--text-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] hover:border-[var(--text-muted)]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-3 py-2">
              <p className="text-[var(--text-xs)] text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Generate button (sticky bottom) */}
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <p className="mb-2 text-center text-[var(--text-xs)] text-[var(--text-muted)]">
            {creditCost} credits
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-2.5 text-[var(--text-sm)] font-semibold text-[var(--bg-deep)] transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)]" />
                Generating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {mode === "faceswap"
                  ? "Swap Character"
                  : mode === "image2video"
                    ? "Animate Image"
                    : project.videoUrl
                      ? "Regenerate"
                      : "Generate"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══ CENTER + RIGHT: Scrollable Video + Details ═══ */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Current video section */}
        <div className="flex flex-1">
          {/* Video player */}
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-deep)] shadow-[0_0_80px_rgba(0,0,0,0.4)]">
              <div className="pointer-events-none absolute inset-0 vignette" />

              {activeVideoUrl ? (
                <video
                  key={activeVideoUrl}
                  src={activeVideoUrl}
                  controls
                  loop
                  className="relative z-10 w-full rounded-[var(--radius-lg)] object-contain"
                />
              ) : generating ? (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-4">
                  <div className="relative h-14 w-14">
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--accent-amber)]" />
                    <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-[var(--accent-amber)]/40" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                      {mode === "faceswap" ? "Swapping character..." : mode === "image2video" ? "Animating image..." : "Generating your video"}
                    </p>
                    <p className="mt-1 text-[var(--text-xs)] text-[var(--text-muted)]">This usually takes 1-3 minutes</p>
                  </div>
                  <ProgressBar progress={30} animated className="w-48" />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--text-muted)]">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span className="text-[var(--text-sm)] text-[var(--text-muted)]">
                    {mode === "faceswap"
                      ? "Upload a video and select a character"
                      : mode === "image2video"
                        ? "Choose an image and describe the motion"
                        : "Describe your video and generate"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right details panel */}
          <div className="w-[260px] flex-shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 p-4 overflow-y-auto">
            {/* Status */}
            <div className="mb-4 flex items-center justify-between">
              <Badge variant={STATUS_VARIANT[activeStatus] ?? "default"}>
                {STATUS_LABEL[activeStatus] ?? activeStatus}
              </Badge>
              {activeVideoUrl && (
                <button
                  onClick={handleDownload}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-amber)]"
                  title="Download"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}
            </div>

            {/* Title */}
            <h3 className="mb-4 font-display text-sm font-bold text-[var(--text-primary)]">
              {activeName}
            </h3>

            {/* Prompt */}
            {activePrompt && (
              <div className="mb-4">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Prompt
                </span>
                <p className="text-[var(--text-sm)] leading-relaxed text-[var(--text-secondary)]">
                  {activePrompt}
                </p>
              </div>
            )}

            {/* Metadata pills */}
            <div className="mb-4 flex flex-wrap gap-2">
              {activeMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-input)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {MODE_LABEL[activeMode] ?? activeMode}
                </span>
              )}
              {activeDuration && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-input)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {activeDuration}s
                </span>
              )}
              {activeAspectRatio && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-input)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                  {activeAspectRatio}
                </span>
              )}
            </div>

            {/* Character */}
            {activeCharacterName && (
              <div className="mb-4">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Character
                </span>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                  {activeCharacterName}
                </p>
              </div>
            )}

            {/* View full project link for history items */}
            {viewingHistory && (
              <Link
                href={`/projects/${viewingHistory.id}`}
                className="mt-2 block text-center text-[var(--text-xs)] text-[var(--accent-amber)] transition-colors hover:underline"
              >
                Open this project
              </Link>
            )}
          </div>
        </div>

        {/* ─── History Feed ─── */}
        {history.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/30 px-6 py-4">
            <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              History
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* Current project card */}
              <button
                onClick={() => setViewingHistory(null)}
                className={`group flex-shrink-0 rounded-[var(--radius-md)] border p-2 transition-all duration-200 ${
                  !viewingHistory
                    ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-12 w-16 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-deep)]">
                    {project.videoUrl ? (
                      <video src={project.videoUrl} className="h-full w-full rounded-[var(--radius-sm)] object-cover" muted />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="max-w-[100px] truncate text-[var(--text-xs)] font-medium text-[var(--text-primary)]">
                      {project.name}
                    </p>
                    <p className="text-[9px] text-[var(--accent-amber)]">Current</p>
                  </div>
                </div>
              </button>

              {/* History items */}
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setViewingHistory(item)}
                  className={`group flex-shrink-0 rounded-[var(--radius-md)] border p-2 transition-all duration-200 ${
                    viewingHistory?.id === item.id
                      ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/5"
                      : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-12 w-16 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-deep)] overflow-hidden">
                      {item.videoUrl ? (
                        <video src={item.videoUrl} className="h-full w-full rounded-[var(--radius-sm)] object-cover" muted />
                      ) : (
                        <Badge variant={STATUS_VARIANT[item.status] ?? "default"} className="scale-75">
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="max-w-[100px] truncate text-[var(--text-xs)] font-medium text-[var(--text-primary)]">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-[var(--text-muted)]">
                        {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
