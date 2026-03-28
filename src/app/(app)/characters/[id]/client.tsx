"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";

const ANGLE_LABELS = ["Front", "¾ Left", "¾ Right", "Full Body"];

interface CharacterData {
  id: string;
  name: string;
  description: string | null;
  style: string;
  signedUrls: string[];
  createdAt: string;
}

export function CharacterDetailClient({
  character,
}: {
  character: CharacterData;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this character? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/characters");
    } catch {
      setDeleting(false);
    }
  };

  const createdLabel = new Date(character.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="md:hidden">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">

          {/* Hero photo */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-input)]">
            <div className="pointer-events-none absolute inset-0 z-10">
              <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-white/20" />
              <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-white/20" />
              <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/20" />
              <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/20" />
            </div>
            {character.signedUrls[0] ? (
              <img
                src={character.signedUrls[0]}
                alt={`${character.name} — Front`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-sm text-[var(--text-muted)]">No image</span>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="space-y-4 p-5">
            {/* Name + meta */}
            <div>
              <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">
                {character.name}
              </h1>
              <div className="mt-1.5 flex items-center gap-2.5">
                <Badge variant="amber">{character.style}</Badge>
                <span className="text-xs text-[var(--text-muted)]">Created {createdLabel}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/projects")}
                className="w-full"
              >
                Use in Project
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>

            {/* Description */}
            {character.description && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {character.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional angles */}
        {character.signedUrls.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {character.signedUrls.slice(1).map((url, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]"
              >
                <img
                  src={url}
                  alt={`${character.name} — ${ANGLE_LABELS[i + 1] ?? `Angle ${i + 2}`}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <span className="text-[10px] font-medium text-white">
                    {ANGLE_LABELS[i + 1] ?? `Angle ${i + 2}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex md:justify-center">
        <div className="w-full max-w-3xl space-y-4">

          {/* Main card: hero image + info panel side by side */}
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="flex">

              {/* Hero image */}
              <div className="relative w-72 shrink-0 overflow-hidden bg-[var(--bg-input)]">
                <div className="pointer-events-none absolute inset-0 z-10">
                  <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-white/20" />
                  <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-white/20" />
                  <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/20" />
                  <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/20" />
                </div>
                {character.signedUrls[0] ? (
                  <img
                    src={character.signedUrls[0]}
                    alt={`${character.name} — Front`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center">
                    <span className="text-sm text-[var(--text-muted)]">No image</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <span className="text-xs font-medium text-white">Front</span>
                </div>
              </div>

              {/* Info panel */}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex-1">
                  <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                    {character.name}
                  </h1>
                  <div className="mt-2 flex items-center gap-3">
                    <Badge variant="amber">{character.style}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">Created {createdLabel}</span>
                  </div>
                  {character.description && (
                    <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {character.description}
                    </p>
                  )}
                </div>

                {/* Buttons pinned to bottom of panel */}
                <div className="mt-6 flex gap-2 border-t border-[var(--border-subtle)] pt-5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push("/projects")}
                  >
                    Use in Project
                  </Button>
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
            </div>
          </div>

          {/* Remaining angle images */}
          {character.signedUrls.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {character.signedUrls.slice(1).map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]"
                >
                  <div className="pointer-events-none absolute inset-0 z-10">
                    <span className="absolute left-2 top-2 h-3 w-3 border-l border-t border-white/20" />
                    <span className="absolute right-2 top-2 h-3 w-3 border-r border-t border-white/20" />
                    <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-white/20" />
                    <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-white/20" />
                  </div>
                  <img
                    src={url}
                    alt={`${character.name} — ${ANGLE_LABELS[i + 1] ?? `Angle ${i + 2}`}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <span className="text-xs font-medium text-white">
                      {ANGLE_LABELS[i + 1] ?? `Angle ${i + 2}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
