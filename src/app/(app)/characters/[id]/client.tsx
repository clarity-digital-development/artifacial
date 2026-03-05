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

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            {character.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="amber">{character.style}</Badge>
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              Created{" "}
              {new Date(character.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          {character.description && (
            <p className="mt-3 max-w-lg text-[var(--text-sm)] text-[var(--text-secondary)]">
              {character.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
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

      {/* Reference images grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {character.signedUrls.map((url, i) => (
          <div
            key={i}
            className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)]"
          >
            {/* Viewfinder corners */}
            <div className="pointer-events-none absolute inset-0 z-10">
              <span className="absolute left-2 top-2 h-3 w-3 border-l border-t border-[var(--text-muted)]/40" />
              <span className="absolute right-2 top-2 h-3 w-3 border-r border-t border-[var(--text-muted)]/40" />
              <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[var(--text-muted)]/40" />
              <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[var(--text-muted)]/40" />
            </div>

            <img
              src={url}
              alt={`${character.name} — ${ANGLE_LABELS[i] ?? `Angle ${i + 1}`}`}
              className="h-full w-full object-cover"
            />

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
              <span className="text-[var(--text-xs)] font-medium text-white">
                {ANGLE_LABELS[i] ?? `Angle ${i + 1}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
