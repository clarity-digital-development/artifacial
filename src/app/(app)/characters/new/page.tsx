"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Select } from "@/components/ui/select";
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
  { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash (Preview)" },
  { value: "gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro (Preview)" },
];

const TAB_OPTIONS = [
  { value: "photo", label: "From Photo" },
  { value: "description", label: "From Description" },
];

export default function NewCharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const initialTab = searchParams.get("tab") === "description" || initialPrompt ? "description" : "photo";
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(initialPrompt);
  const [style, setStyle] = useState("photorealistic");
  const [model, setModel] = useState("gemini-2.0-flash-exp-image-generation");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoPreviewRef = useRef<string | null>(null);

  const hasImages = images.some((img) => img !== null);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    };
  }, []);

  const handlePhotoSelect = useCallback((file: File) => {
    setPhoto(file);
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    const url = URL.createObjectURL(file);
    photoPreviewRef.current = url;
    setPhotoPreview(url);
  }, []);

  const handleGenerate = async () => {
    if (!name.trim()) {
      setError("Character name is required");
      return;
    }
    if (tab === "photo" && !photo) {
      setError("Please upload a photo");
      return;
    }
    if (tab === "description" && !description.trim()) {
      setError("Please describe your character");
      return;
    }

    setError(null);
    setGenerating(true);
    setImages([null, null, null, null]);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("style", style);
      formData.append("mode", tab);
      formData.append("model", model);
      if (description.trim()) formData.append("description", description.trim());
      if (photo) formData.append("photo", photo);

      const res = await fetch("/api/characters/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "insufficient_credits") {
          setError(
            `Not enough credits. Need ${data.required}, have ${data.available}.`
          );
          setGenerating(false);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      // SSE stream — each event is a completed image
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
              next[data.index] = data.url;
              return next;
            });
          } else if (data.type === "complete") {
            setGenerating(false);
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
      // Stream ended — ensure generating is always reset
      setGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const referenceImages = images.filter(Boolean) as string[];
    if (referenceImages.length === 0 || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
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
    }
  };

  return (
    <div className="flex h-full gap-8">
      {/* Left Panel — Controls */}
      <div className="flex w-[40%] min-w-[320px] flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            New Character
          </h1>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
            Create a character from a photo or description
          </p>
        </div>

        <PillToggle options={TAB_OPTIONS} value={tab} onChange={setTab} />

        {tab === "photo" ? (
          <UploadZone
            onFile={handlePhotoSelect}
            preview={photoPreview}
            className="min-h-[180px]"
          />
        ) : (
          <Textarea
            label="Describe your character in detail"
            placeholder="A woman in her 30s with short dark hair, wearing a leather jacket, confident expression, warm brown eyes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        )}

        <Input
          label="Character Name"
          placeholder="e.g. Warrior Queen, Neon Detective..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {tab === "photo" && (
          <Textarea
            label="Style Description (optional)"
            placeholder="Add style details: clothing, mood, setting, era..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        )}

        <Select
          label="Output Style"
          options={STYLE_OPTIONS}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        />

        <Select
          label="AI Model"
          options={MODEL_OPTIONS}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />

        {error && (
          <p className="text-[var(--text-sm)] text-[var(--error)]">{error}</p>
        )}

        <Button
          fullWidth
          size="lg"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Generating..." : "Generate Character"}
        </Button>

        <p className="text-center text-[var(--text-xs)] text-[var(--text-muted)]">
          Uses 40 credits (10 per angle)
        </p>
      </div>

      {/* Right Panel — Preview */}
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
          Character Preview
        </h2>

        <CharacterPreviewGrid
          images={images}
          generating={generating}
          onRegenerateAngle={undefined}
        />

        {hasImages && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleGenerate}
              disabled={generating}
            >
              Regenerate All
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={generating || saving}>
              {saving ? "Saving..." : "Save Character"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
