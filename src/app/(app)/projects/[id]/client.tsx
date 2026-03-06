"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { PillToggle } from "@/components/ui/pill-toggle";
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

const MODE_OPTIONS = [
  { value: "text2video", label: "Text to Video" },
  { value: "faceswap", label: "Swap into Video" },
  { value: "image2video", label: "Animate Image" },
];

const DURATION_OPTIONS = [
  { value: "5", label: "5s" },
  { value: "10", label: "10s" },
];

const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
];

// Credit costs (mirrored from stripe.ts to avoid server import)
const CREDIT_COST_VIDEO_5S = 200;
const CREDIT_COST_VIDEO_10S = 400;

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
    if (!project.videoUrl) return;
    const a = document.createElement("a");
    a.href = project.videoUrl;
    a.download = `${project.name.replace(/\s+/g, "-")}.mp4`;
    a.click();
  };

  const selectedChar = characters.find((c) => c.id === project.characterId);

  // ─── Render ───

  return (
    <div className="flex h-full gap-8">
      {/* Left Panel — Controls (40%) */}
      <div className="flex w-[40%] min-w-[340px] flex-col gap-5 overflow-y-auto pr-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="bg-transparent font-display text-xl font-bold text-[var(--text-primary)] outline-none border-b border-[var(--accent-amber)]"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setEditingName(true);
                  setTimeout(() => nameInputRef.current?.focus(), 0);
                }}
                className="font-display text-xl font-bold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-amber)]"
              >
                {project.name}
              </button>
            )}
            <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>
              {STATUS_LABEL[project.status] ?? project.status}
            </Badge>
          </div>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Delete"}
          </Button>
        </div>

        {/* Character selector */}
        <div className="relative" ref={pickerRef}>
          <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
            Character
          </label>
          <button
            onClick={() => setShowCharacterPicker(!showCharacterPicker)}
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2.5 transition-all duration-200 hover:border-[var(--border-default)]"
          >
            {project.characterThumbnail ? (
              <img src={project.characterThumbnail} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-xs)] text-[var(--text-muted)]">
                {project.characterName?.[0] ?? "?"}
              </div>
            )}
            <span className="flex-1 text-left text-[var(--text-sm)] text-[var(--text-primary)]">
              {project.characterName ?? "Select a character"}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showCharacterPicker && (
            <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => changeCharacter(null)}
                className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--text-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                None
              </button>
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => changeCharacter(c.id)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--text-sm)] hover:bg-[var(--bg-elevated)] ${
                    c.id === project.characterId ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-xs)] text-[var(--text-muted)]">
                      {c.name[0]}
                    </div>
                  )}
                  {c.name}
                  <span className="ml-auto text-[var(--text-xs)] text-[var(--text-muted)]">{c.style}</span>
                </button>
              ))}
              {characters.length === 0 && (
                <p className="px-3 py-2 text-[var(--text-xs)] text-[var(--text-muted)]">No characters yet</p>
              )}
            </div>
          )}
        </div>

        {/* Mode tabs */}
        <div>
          <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
            Generation Mode
          </label>
          <PillToggle options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>

        {/* ─── Text to Video ─── */}
        {mode === "text2video" && (
          <>
            <Textarea
              label="Video Prompt"
              placeholder="Describe your video in detail — action, movement, environment, mood..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Duration</label>
                <PillToggle options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Aspect Ratio</label>
                <PillToggle options={ASPECT_OPTIONS} value={aspectRatio} onChange={setAspectRatio} />
              </div>
            </div>
          </>
        )}

        {/* ─── Face Swap ─── */}
        {mode === "faceswap" && (
          <>
            <div>
              <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Source Video</label>
              {sourceVideoPreview ? (
                <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)]">
                  <video src={sourceVideoPreview} className="w-full max-h-[200px] object-contain bg-black" controls muted />
                  <button
                    onClick={() => { setSourceVideo(null); setSourceVideoPreview(null); }}
                    className="absolute right-2 top-2 rounded-full bg-[var(--bg-deep)]/80 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <UploadZone onFile={handleVideoUpload} accept="video/mp4,video/quicktime,video/webm" className="min-h-[120px]" />
              )}
              <p className="mt-1 text-[var(--text-xs)] text-[var(--text-muted)]">MP4 or MOV, max 30 seconds</p>
            </div>
            {selectedChar && (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                {project.characterThumbnail ? (
                  <img src={project.characterThumbnail} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">{selectedChar.name[0]}</div>
                )}
                <div>
                  <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{selectedChar.name}</p>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)]">Will be swapped into the video</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Animate Image ─── */}
        {mode === "image2video" && (
          <>
            <div>
              <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Source Image</label>
              {sourceImagePreview ? (
                <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)]">
                  <img src={sourceImagePreview} alt="Source" className="w-full max-h-[200px] object-contain bg-black" />
                  <button
                    onClick={() => { setSourceImage(null); setSourceImagePreview(null); }}
                    className="absolute right-2 top-2 rounded-full bg-[var(--bg-deep)]/80 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : project.characterThumbnail ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <img src={project.characterThumbnail} alt="" className="h-16 w-16 rounded-[var(--radius-sm)] object-cover" />
                    <div>
                      <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Using character reference</p>
                      <p className="text-[var(--text-xs)] text-[var(--text-muted)]">Or upload a different image below</p>
                    </div>
                  </div>
                  <UploadZone onFile={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="min-h-[80px]" />
                </div>
              ) : (
                <UploadZone onFile={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="min-h-[120px]" />
              )}
            </div>
            <Textarea
              label="Motion Prompt"
              placeholder="Describe the motion: walking toward camera, turning head slowly, wind blowing hair..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Duration</label>
                <PillToggle options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">Aspect Ratio</label>
                <PillToggle options={ASPECT_OPTIONS} value={aspectRatio} onChange={setAspectRatio} />
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-[var(--text-sm)] text-red-400">{error}</p>
          </div>
        )}

        {/* Credit cost + Generate */}
        <p className="text-center text-[var(--text-xs)] text-[var(--text-muted)]">
          This will use {creditCost} credits
        </p>
        <Button fullWidth size="lg" onClick={handleGenerate} disabled={generating}>
          {generating
            ? "Generating..."
            : mode === "faceswap"
              ? "Swap Character"
              : mode === "image2video"
                ? "Animate Image"
                : project.videoUrl
                  ? "Regenerate Video"
                  : "Generate Video"}
        </Button>
      </div>

      {/* Right Panel — Preview (60%) */}
      <div className="flex flex-1 flex-col gap-4">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-deep)] shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]">
          <div className="pointer-events-none absolute inset-0 vignette" />

          {project.videoUrl ? (
            <video src={project.videoUrl} controls loop className="h-full w-full rounded-[var(--radius-lg)] object-contain" />
          ) : generating ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--accent-amber)]" />
                <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-[var(--accent-amber)]/40" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              </div>
              <div className="text-center">
                <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  {mode === "faceswap" ? "Swapping character..." : mode === "image2video" ? "Animating image..." : "Generating your video"}
                </p>
                <p className="mt-1 text-[var(--text-xs)] text-[var(--text-muted)]">This usually takes 1–3 minutes</p>
              </div>
              <ProgressBar progress={30} animated className="w-48" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--accent-amber)]/40">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="text-[var(--text-sm)]">
                {mode === "faceswap"
                  ? "Upload a video and select a character"
                  : mode === "image2video"
                    ? "Choose an image and describe the motion"
                    : "Describe your video and generate"}
              </span>
            </div>
          )}
        </div>

        {project.videoUrl && (
          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleDownload}>Download</Button>
            <Button variant="secondary" className="flex-1" onClick={handleGenerate} disabled={generating}>Regenerate</Button>
          </div>
        )}
      </div>
    </div>
  );
}
