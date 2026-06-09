"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";

// Curated quick-action presets to surface on the character detail page.
// Each links to its workshop tool — the user picks the character via the
// library selector inside the form (no query-param prefill needed for v1).
const QUICK_PRESETS = [
  { slug: "preset-ugc-hook",      label: "UGC Hook",       hint: "Phone-style creator ad" },
  { slug: "preset-magazine-cover", label: "Magazine Cover", hint: "Editorial portrait still" },
  { slug: "preset-red-carpet",    label: "Red Carpet",     hint: "Paparazzi-flash glamour" },
  { slug: "preset-anime",         label: "Anime",          hint: "Anime transformation" },
  { slug: "photodump",            label: "Photodump",      hint: "12 cinematic scenes" },
  { slug: "headshot-generator",   label: "Headshots",      hint: "6 polished studio looks" },
];

async function downloadCharacterImage(signedUrl: string, characterId: string) {
  const fileName = `artifacial-character-${characterId}.webp`;
  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(signedUrl)}&filename=${encodeURIComponent(fileName)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const file = new File([blob], fileName, { type: "image/webp" });

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) {
        if ((e as Error)?.name !== "AbortError") window.open(signedUrl, "_blank");
      }
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    window.open(signedUrl, "_blank");
  }
}

interface CharacterData {
  id: string;
  name: string;
  description: string | null;
  style: string;
  signedUrls: string[];
  createdAt: string;
  isPublic: boolean;
  cloneCount: number;
}

interface GenerationItem {
  id: string;
  workflowType: string;
  modelId: string | null;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  completedAt: string | null;
}

export function CharacterDetailClient({
  character,
  recentGenerations = [],
}: {
  character: CharacterData;
  recentGenerations?: GenerationItem[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(character.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const [displayName, setDisplayName] = useState(character.name);

  // Community publish state
  const [isPublic, setIsPublic] = useState(character.isPublic);
  const [publishing, setPublishing] = useState(false);

  const handleTogglePublish = async () => {
    const next = !isPublic;
    if (next && !confirm("Publish this character to the community gallery? Anyone can clone it into their library. You can unpublish at any time.")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error();
      setIsPublic(next);
    } catch {
      // keep previous state
    } finally {
      setPublishing(false);
    }
  };

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === displayName) { setRenaming(false); return; }
    setRenameSaving(true);
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      setDisplayName(trimmed);
      setRenaming(false);
    } catch {
      // keep modal open on error
    } finally {
      setRenameSaving(false);
    }
  };

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
                alt={character.name}
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
              {renaming ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenaming(false); setNewName(displayName); } }}
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--accent-amber)] bg-[var(--bg-elevated)] px-3 py-1.5 font-display text-xl font-bold text-[var(--text-primary)] outline-none"
                  />
                </div>
              ) : (
                <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  {displayName}
                </h1>
              )}
              <div className="mt-1.5 flex items-center gap-2.5">
                <Badge variant="amber">{character.style}</Badge>
                <span className="text-xs text-[var(--text-muted)]">Created {createdLabel}</span>
              </div>
            </div>

            {/* Action buttons */}
            {renaming ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setRenaming(false); setNewName(displayName); }} className="w-full">Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleRename} disabled={renameSaving} className="w-full">{renameSaving ? "Saving…" : "Save"}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => router.push(`/generate?characterId=${character.id}&mode=I2V`)} className="w-full">Use in Project</Button>
                <Button variant="secondary" size="sm" onClick={() => character.signedUrls[0] && downloadCharacterImage(character.signedUrls[0], character.id)} className="w-full">Download</Button>
                <Button variant="secondary" size="sm" onClick={() => { setNewName(displayName); setRenaming(true); }} className="w-full">Rename</Button>
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting} className="w-full">{deleting ? "Deleting…" : "Delete"}</Button>
              </div>
            )}

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
                    alt={character.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center">
                    <span className="text-sm text-[var(--text-muted)]">No image</span>
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex-1">
                  {renaming ? (
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenaming(false); setNewName(displayName); } }}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--accent-amber)] bg-[var(--bg-elevated)] px-3 py-1.5 font-display text-2xl font-bold text-[var(--text-primary)] outline-none"
                    />
                  ) : (
                    <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                      {displayName}
                    </h1>
                  )}
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
                  {renaming ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => { setRenaming(false); setNewName(displayName); }}>Cancel</Button>
                      <Button variant="primary" size="sm" onClick={handleRename} disabled={renameSaving}>{renameSaving ? "Saving..." : "Save"}</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => router.push(`/generate?characterId=${character.id}&mode=I2V`)}>Use in Project</Button>
                      <Button variant="secondary" size="sm" onClick={() => character.signedUrls[0] && downloadCharacterImage(character.signedUrls[0], character.id)}>Download</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setNewName(displayName); setRenaming(true); }}>Rename</Button>
                      <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Publish to community ── */}
      <section className="mt-8 md:mx-auto md:max-w-3xl">
        <div className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5 sm:flex-row sm:items-center sm:justify-between ${
          isPublic ? "border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/5" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {isPublic ? "Published to community" : "Share with the community?"}
              </h3>
              {isPublic && (
                <span className="rounded-full bg-[var(--accent-amber)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
                  Public
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {isPublic
                ? `Anyone can browse and clone this character. ${character.cloneCount > 0 ? `Cloned ${character.cloneCount} time${character.cloneCount === 1 ? "" : "s"} so far.` : "No clones yet."}`
                : "Publish to the community gallery so other creators can add your character to their library."}
            </p>
          </div>
          <button
            onClick={handleTogglePublish}
            disabled={publishing}
            className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              isPublic
                ? "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
                : "bg-[var(--accent-amber)] text-black hover:opacity-90"
            }`}
          >
            {publishing ? "Saving…" : isPublic ? "Unpublish" : "Publish"}
          </button>
        </div>
      </section>

      {/* ── Try these presets — works on both mobile + desktop ── */}
      <section className="mt-8 md:mx-auto md:max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Try {displayName} in…
          </h2>
          <Link href="/workshop" className="text-[11px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]">
            Browse all tools
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_PRESETS.map((p) => (
            <Link
              key={p.slug}
              href={`/workshop/${p.slug}`}
              className="group relative aspect-video overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all hover:border-[var(--accent-amber)]/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/workshop-thumbs/${p.slug}.webp`}
                alt={p.label}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="text-[12px] font-semibold text-white">{p.label}</p>
                <p className="text-[10px] text-white/70">{p.hint}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent generations of this character ── */}
      {recentGenerations.length > 0 && (
        <section className="mt-8 md:mx-auto md:max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Recent generations of {displayName} · <span className="text-[var(--text-secondary)]">{recentGenerations.length}</span>
            </h2>
            <Link href="/gallery" className="text-[11px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]">
              Full gallery
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {recentGenerations.map((g) => {
              const isVideo = g.workflowType.includes("VIDEO") || g.modelId === "marketing-studio";
              const modelLabel = g.modelId ?? "generation";
              const previewUrl = g.thumbnailUrl ?? g.outputUrl;
              return (
                <Link
                  key={g.id}
                  href="/gallery"
                  className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                >
                  {previewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={previewUrl} alt={modelLabel} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-muted)]">no preview</div>
                  )}
                  {isVideo && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white">
                      Video
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="truncate text-[10px] uppercase tracking-wider text-white/85">{modelLabel}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
