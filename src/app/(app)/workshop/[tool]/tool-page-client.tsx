"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { WorkshopTool, OutputType } from "@/lib/workshop/tools";

// ─── Shared primitives ───────────────────────────────────────────────────────

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-medium text-[var(--text-secondary)] ${className ?? "mb-1.5"}`}>{children}</p>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-[var(--text-muted)]">{children}</p>;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] disabled:opacity-50"
      />
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] disabled:opacity-50"
      />
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div ref={ref} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 text-left text-sm transition-colors disabled:opacity-50 ${
            open
              ? "border-[var(--accent-amber)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--border-subtle)]"
          }`}
        >
          <span className="truncate">{selected?.label}</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            {options.map((o) => {
              const isActive = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
            checked ? "bg-[var(--accent-amber)]" : "bg-[var(--border-default)]"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function ImageUpload({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) onFile(file);
        }}
        className={`relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-dashed transition-colors ${
          value
            ? "border-[var(--accent-amber)]/50"
            : "border-[var(--border-default)] hover:border-[var(--accent-amber)]/40"
        } bg-[var(--bg-elevated)]`}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover rounded-[var(--radius-md)]"
          />
        ) : (
          <div className="text-center">
            <svg
              className="mx-auto mb-1.5 text-[var(--text-muted)]"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-xs text-[var(--text-muted)]">Click or drag to upload</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">JPG · PNG · WebP</p>
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white text-sm leading-none hover:bg-black"
          >
            ×
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

type LibraryVideo = { id: string; url: string; thumbnailUrl: string | null };

function VideoInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [tab, setTab] = useState<"link" | "upload" | "library">("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryVideo[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryFetched, setLibraryFetched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "library" || libraryFetched) return;
    setLibraryLoading(true);
    fetch("/api/workshop/media")
      .then((r) => r.json())
      .then((data) => {
        setLibraryItems(data.videos ?? []);
        setLibraryFetched(true);
      })
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  }, [tab, libraryFetched]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/workshop/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
      setTab("link");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    { id: "link" as const, label: "Link" },
    { id: "upload" as const, label: "Upload" },
    { id: "library" as const, label: "Library" },
  ];

  return (
    <div>
      <Label>{label}</Label>
      {/* Tab bar */}
      <div className="mb-2 flex gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-[calc(var(--radius-md)-2px)] py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "link" && (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)]"
        />
      )}

      {tab === "upload" && (
        <div>
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("video/")) handleFile(file);
            }}
            className={`flex h-24 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-dashed transition-colors ${
              uploading
                ? "border-[var(--accent-amber)]/50 bg-[var(--bg-elevated)]"
                : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--accent-amber)]/40"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <svg className="animate-spin text-[var(--accent-amber)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <p className="text-xs text-[var(--text-muted)]">Uploading…</p>
              </div>
            ) : value ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <svg className="text-[var(--accent-amber)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="text-xs text-[var(--text-muted)]">Uploaded — click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-center">
                <svg className="text-[var(--text-muted)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-xs text-[var(--text-muted)]">Click or drag .mp4 file</p>
                <p className="text-[10px] text-[var(--text-muted)]">MP4 · MOV · WebM · Max 10 MB</p>
              </div>
            )}
          </div>
          {uploadError && <p className="mt-1 text-[11px] text-[var(--error)]">{uploadError}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "library" && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2">
          {libraryLoading ? (
            <div className="flex h-24 items-center justify-center">
              <svg className="animate-spin text-[var(--text-muted)]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : libraryItems.length === 0 ? (
            <div className="flex h-24 flex-col items-center justify-center gap-1 text-center">
              <p className="text-xs text-[var(--text-muted)]">No videos yet</p>
              <p className="text-[10px] text-[var(--text-muted)]">Generate videos in Studio to use them here</p>
            </div>
          ) : (
            <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">
              {libraryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.url); setTab("link"); }}
                  className={`relative aspect-video overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all ${
                    value === item.url
                      ? "border-[var(--accent-amber)]"
                      : "border-transparent hover:border-[var(--border-subtle)]"
                  }`}
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--bg-surface)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step ?? 1}
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-amber)]"
      />
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

// ─── ImageInput (Device + Characters tabs) ───────────────────────────────────

type LibraryImage = { id: string; url: string; name?: string | null };

function ImageInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [tab, setTab] = useState<"device" | "characters">("device");
  const [characters, setCharacters] = useState<LibraryImage[]>([]);
  const [charLoading, setCharLoading] = useState(false);
  const [charFetched, setCharFetched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "characters" || charFetched) return;
    setCharLoading(true);
    fetch("/api/workshop/media")
      .then((r) => r.json())
      .then((data) => {
        setCharacters(data.images ?? []);
        setCharFetched(true);
      })
      .catch(() => {})
      .finally(() => setCharLoading(false));
  }, [tab, charFetched]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {label && <Label>{label}</Label>}
      {/* Tab bar */}
      <div className="mb-2 flex gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-0.5">
        {(["device", "characters"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => !disabled && setTab(t)}
            className={`flex-1 rounded-[calc(var(--radius-md)-2px)] py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t === "device" ? "Device" : "Characters"}
          </button>
        ))}
      </div>

      {tab === "device" && (
        <div>
          <div
            onClick={() => !disabled && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (disabled) return;
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) onFile(file);
            }}
            className={`relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-dashed transition-colors ${
              disabled ? "cursor-not-allowed opacity-50" : ""
            } ${
              value
                ? "border-[var(--accent-amber)]/50"
                : "border-[var(--border-default)] hover:border-[var(--accent-amber)]/40"
            } bg-[var(--bg-elevated)]`}
          >
            {value ? (
              <img src={value} alt="" className="h-full w-full object-cover rounded-[var(--radius-md)]" />
            ) : (
              <div className="text-center">
                <svg className="mx-auto mb-1.5 text-[var(--text-muted)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-xs text-[var(--text-muted)]">Click or drag to upload</p>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">JPEG · PNG · WebP · Max 10 MB</p>
              </div>
            )}
            {value && !disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white text-sm leading-none hover:bg-black"
              >
                ×
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "characters" && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2">
          {charLoading ? (
            <div className="flex h-20 items-center justify-center">
              <svg className="animate-spin text-[var(--text-muted)]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : characters.length === 0 ? (
            <div className="flex h-20 flex-col items-center justify-center gap-1 text-center">
              <p className="text-xs text-[var(--text-muted)]">No characters yet</p>
              <p className="text-[10px] text-[var(--text-muted)]">Create a character to use it here</p>
            </div>
          ) : (
            /* Horizontal scrollable strip — same thumbnail size as /edit */
            <div className="flex gap-2 overflow-x-auto pb-1">
              {characters.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  disabled={disabled}
                  title={char.name ?? undefined}
                  onClick={() => { onChange(char.url); setTab("device"); }}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all disabled:opacity-50 ${
                    value === char.url
                      ? "border-[var(--accent-amber)] shadow-[0_0_8px_rgba(232,166,52,0.3)]"
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-[var(--border-subtle)]"
                  }`}
                >
                  <img src={char.url} alt={char.name ?? ""} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-default)] text-[10px] font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--accent-amber)]/50 hover:text-[var(--accent-amber)]"
      >
        i
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-64 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-xs leading-relaxed text-[var(--text-secondary)] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          {content}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Individual tool forms ────────────────────────────────────────────────────

function PhotoFaceSwapForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [swapImage, setSwapImage] = useState<string | null>(null);
  const valid = !!targetImage && !!swapImage;
  return (
    <div className="space-y-4">
      <ImageUpload label="Target Photo" value={targetImage} onChange={setTargetImage} hint="The photo you want to change" />
      <ImageUpload label="Source Face" value={swapImage} onChange={setSwapImage} hint="The face to use as replacement" />
      <SubmitButton disabled={!valid} loading={loading} credits={40} onClick={() => onSubmit({ targetImage, swapImage })} />
    </div>
  );
}

function MultiFaceSwapForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [swapImage, setSwapImage] = useState<string | null>(null);
  const [swapFacesIndex, setSwapFacesIndex] = useState("0");
  const [targetFacesIndex, setTargetFacesIndex] = useState("0");
  const valid = !!targetImage && !!swapImage;
  return (
    <div className="space-y-4">
      <ImageUpload label="Target Photo" value={targetImage} onChange={setTargetImage} hint="Photo whose faces will be replaced" />
      <ImageUpload label="Source Face Photo" value={swapImage} onChange={setSwapImage} hint="Photo containing the replacement face(s)" />
      <TextInput label="Swap Faces Index" value={swapFacesIndex} onChange={setSwapFacesIndex} placeholder="0" hint="Face indices in source image to use, comma-separated (0 = leftmost)" />
      <TextInput label="Target Faces Index" value={targetFacesIndex} onChange={setTargetFacesIndex} placeholder="0" hint="Face indices in target image to replace, comma-separated" />
      <SubmitButton disabled={!valid} loading={loading} credits={60} onClick={() => onSubmit({ targetImage, swapImage, swapFacesIndex, targetFacesIndex })} />
    </div>
  );
}

function VideoFaceSwapForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [targetVideoUrl, setTargetVideoUrl] = useState("");
  const [swapImage, setSwapImage] = useState<string | null>(null);
  const [swapFacesIndex, setSwapFacesIndex] = useState("");
  const [targetFacesIndex, setTargetFacesIndex] = useState("");
  const valid = !!targetVideoUrl && !!swapImage;
  return (
    <div className="space-y-4">
      <VideoInput label="Target Video URL" value={targetVideoUrl} onChange={setTargetVideoUrl} hint="MP4 only · max 720p · max 10 MB · max 600 frames" />
      <ImageUpload label="Source Face" value={swapImage} onChange={setSwapImage} hint="The face to swap onto the video" />
      <TextInput label="Swap Faces Index (optional)" value={swapFacesIndex} onChange={setSwapFacesIndex} placeholder="0" hint="Face index in source image (leave blank for auto)" />
      <TextInput label="Target Faces Index (optional)" value={targetFacesIndex} onChange={setTargetFacesIndex} placeholder="0" hint="Face index to replace in video (leave blank for auto)" />
      <SubmitButton disabled={!valid} loading={loading} credits={2400} onClick={() => onSubmit({ targetVideoUrl, swapImage, swapFacesIndex: swapFacesIndex || undefined, targetFacesIndex: targetFacesIndex || undefined })} />
    </div>
  );
}

function VirtualTryOnForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "split">("full");
  const [dressImage, setDressImage] = useState<string | null>(null);
  const [upperImage, setUpperImage] = useState<string | null>(null);
  const [lowerImage, setLowerImage] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(1);

  const valid = !!modelImage && (mode === "full" ? !!dressImage : !!(upperImage || lowerImage));

  return (
    <div className="space-y-4">
      <ImageUpload label="Person / Model Photo" value={modelImage} onChange={setModelImage} hint="Clear frontal photo with clean background works best" />
      <SelectInput label="Garment Mode" value={mode} onChange={(v) => setMode(v as "full" | "split")} options={[{ value: "full", label: "Full Outfit" }, { value: "split", label: "Top & Bottom Separately" }]} />
      {mode === "full" ? (
        <ImageUpload label="Full Outfit Photo" value={dressImage} onChange={setDressImage} />
      ) : (
        <>
          <ImageUpload label="Top / Upper Garment (optional)" value={upperImage} onChange={setUpperImage} />
          <ImageUpload label="Bottom / Lower Garment (optional)" value={lowerImage} onChange={setLowerImage} />
        </>
      )}
      <SelectInput label="Number of Results" value={String(batchSize)} onChange={(v) => setBatchSize(Number(v))} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} image${n > 1 ? "s" : ""}` }))} />
      <SubmitButton disabled={!valid} loading={loading} credits={280 * batchSize} onClick={() => onSubmit({ modelImage, mode, dressImage, upperImage, lowerImage, batchSize })} />
    </div>
  );
}

function AIHugForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <ImageUpload label="Photo" value={image} onChange={setImage} hint="Works best with two people visible in the photo" />
      <SubmitButton disabled={!image} loading={loading} credits={800} onClick={() => onSubmit({ image })} />
    </div>
  );
}

function LipsyncForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [mode, setMode] = useState<"tts" | "audio">("tts");
  const [ttsText, setTtsText] = useState("");
  const [ttsTimbre, setTtsTimbre] = useState("en_male_1");
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [audioDubbingUrl, setAudioDubbingUrl] = useState("");

  const valid = !!videoUrl && (mode === "tts" ? !!ttsText : !!audioDubbingUrl);

  return (
    <div className="space-y-4">
      <VideoInput label="Video URL" value={videoUrl} onChange={setVideoUrl} hint="Video must have a clear visible face. Paste a URL or upload an MP4." />
      <SelectInput label="Audio Mode" value={mode} onChange={(v) => setMode(v as "tts" | "audio")} options={[{ value: "tts", label: "Text-to-Speech (TTS)" }, { value: "audio", label: "Upload Audio URL" }]} />
      {mode === "tts" ? (
        <>
          <TextArea label="Speech Text" value={ttsText} onChange={setTtsText} placeholder="Enter the text you want the character to say..." rows={3} />
          <SelectInput label="Voice" value={ttsTimbre} onChange={setTtsTimbre} options={[
            { value: "en_male_1", label: "English Male 1" },
            { value: "en_female_1", label: "English Female 1" },
            { value: "en_male_2", label: "English Male 2" },
            { value: "en_female_2", label: "English Female 2" },
          ]} hint="More voices available via PiAPI voice list" />
          <NumberInput label="Speech Speed" value={ttsSpeed} onChange={setTtsSpeed} min={0.5} max={2} step={0.1} hint="1.0 = normal speed" />
        </>
      ) : (
        <TextInput label="Audio File URL" value={audioDubbingUrl} onChange={setAudioDubbingUrl} placeholder="https://..." type="url" />
      )}
      <SubmitButton disabled={!valid} loading={loading} credits={400} onClick={() => onSubmit({ videoUrl, mode, ttsText, ttsTimbre, ttsSpeed, audioDubbingUrl })} />
    </div>
  );
}

const KLING_EFFECTS = [
  { value: "squish", label: "Squish" },
  { value: "expansion", label: "Expansion" },
  { value: "jellycat_oversea", label: "Jellycat" },
  { value: "spinoff", label: "Spin Off" },
  { value: "rocket", label: "Rocket 🚀" },
  { value: "hearting", label: "Hearting ❤️" },
  { value: "fighting", label: "Fighting 🥊" },
  { value: "kissing", label: "Kissing 💋" },
  { value: "hugging", label: "Hugging 🤗" },
  { value: "figure", label: "Figure" },
  { value: "vstack", label: "V-Stack" },
  { value: "birthday", label: "Birthday 🎂" },
  { value: "water", label: "Water 💦" },
  { value: "surfing", label: "Surfing 🏄" },
];

const PROMPT_REQUIRED_EFFECTS = new Set(["rocket", "hearting", "fighting", "kissing", "hugging", "birthday", "water"]);

function KlingEffectsForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [effect, setEffect] = useState("squish");
  const [prompt, setPrompt] = useState("");
  const [professionalMode, setProfessionalMode] = useState(false);

  const needsPrompt = PROMPT_REQUIRED_EFFECTS.has(effect);
  const valid = !!image && (!needsPrompt || !!prompt.trim());
  const credits = professionalMode ? 1840 : 1040;

  return (
    <div className="space-y-4">
      <ImageUpload label="Source Photo" value={image} onChange={setImage} />
      <SelectInput label="Effect" value={effect} onChange={setEffect} options={KLING_EFFECTS} />
      {needsPrompt && (
        <TextInput label="Prompt (required for this effect)" value={prompt} onChange={setPrompt} placeholder="Describe the scene or motion..." />
      )}
      <Toggle label="Professional Mode" checked={professionalMode} onChange={setProfessionalMode} hint={`Higher quality, higher cost (${professionalMode ? "1,840" : "1,040"} credits)`} />
      <SubmitButton disabled={!valid} loading={loading} credits={credits} onClick={() => onSubmit({ image, effect, prompt: prompt || undefined, professionalMode })} />
    </div>
  );
}

function KlingSoundForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"text" | "video">("text");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<5 | 10>(10);
  const [originTaskId, setOriginTaskId] = useState("");

  const valid = mode === "text" ? !!prompt.trim() : !!originTaskId.trim();

  return (
    <div className="space-y-4">
      <SelectInput label="Mode" value={mode} onChange={(v) => setMode(v as "text" | "video")} options={[{ value: "text", label: "Generate Standalone Audio" }, { value: "video", label: "Add Audio to Existing Video" }]} />
      {mode === "text" ? (
        <>
          <TextArea label="Sound Description" value={prompt} onChange={setPrompt} placeholder="e.g., Heavy rain on a tin roof with distant thunder..." rows={3} />
          <SelectInput label="Duration" value={String(duration)} onChange={(v) => setDuration(Number(v) as 5 | 10)} options={[{ value: "5", label: "5 seconds" }, { value: "10", label: "10 seconds" }]} />
        </>
      ) : (
        <TextInput label="Kling Video Task ID" value={originTaskId} onChange={setOriginTaskId} placeholder="Paste a PiAPI video task ID..." hint="The video must be a Kling-generated video referenced by task ID" />
      )}
      <p className="text-xs text-[var(--text-muted)]">Returns 4 audio/video variations.</p>
      <SubmitButton disabled={!valid} loading={loading} credits={280} onClick={() => onSubmit({ mode, prompt, duration, originTaskId })} />
    </div>
  );
}

function AIVideoEditForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [videoUrl, setVideoUrl] = useState("");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(false);

  const activeImages = images.filter(Boolean) as string[];
  const hasAnyInput = !!videoUrl || activeImages.length > 0;

  // Build prompt hint
  const imageRefs = activeImages.map((_, i) => `@image_${i + 1}`).join(", ");
  const videoRef = videoUrl ? "@video" : "";
  const refHint = [imageRefs, videoRef].filter(Boolean).join(", ");

  const creditsMap: Record<string, number> = {
    "720p-5": 1560, "720p-10": 3120, "1080p-5": 2080, "1080p-10": 4160,
  };
  const credits = creditsMap[`${resolution}-${duration}`] ?? 1560;

  return (
    <div className="space-y-4">
      <TextArea label="Prompt" value={prompt} onChange={setPrompt} placeholder={`Describe what you want to generate or how to transform the reference media...${refHint ? `\n\nReference: ${refHint}` : ""}`} rows={4} hint={refHint ? `Use ${refHint} in your prompt to reference the uploaded media` : "Add reference images/video below and mention them with @image_1, @video etc."} />
      <div className="grid grid-cols-2 gap-2">
        <SelectInput label="Resolution" value={resolution} onChange={(v) => setResolution(v as "720p" | "1080p")} options={[{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }]} />
        <SelectInput label="Duration" value={String(duration)} onChange={(v) => setDuration(Number(v) as 5 | 10)} options={[{ value: "5", label: "5 seconds" }, { value: "10", label: "10 seconds" }]} />
      </div>
      <SelectInput label="Aspect Ratio" value={aspectRatio} onChange={setAspectRatio} options={[{ value: "16:9", label: "16:9 Landscape" }, { value: "9:16", label: "9:16 Portrait" }, { value: "1:1", label: "1:1 Square" }]} />

      <div>
        <Label>Reference Images (up to 4, optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <ImageUpload key={i} label={`Image ${i + 1}`} value={images[i]} onChange={(v) => setImages((prev) => { const n = [...prev]; n[i] = v; return n; })} />
          ))}
        </div>
      </div>

      <VideoInput label="Reference Video URL (optional)" value={videoUrl} onChange={setVideoUrl} hint="Mention with @video in your prompt" />
      {videoUrl && <Toggle label="Keep Original Audio" checked={keepOriginalAudio} onChange={setKeepOriginalAudio} />}

      <SubmitButton disabled={!prompt.trim()} loading={loading} credits={credits} onClick={() => onSubmit({ prompt, images: activeImages.length > 0 ? activeImages : undefined, videoUrl: videoUrl || undefined, resolution, duration, aspectRatio, keepOriginalAudio })} />
    </div>
  );
}

function VideoRemoveBgForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [invertOutput, setInvertOutput] = useState(false);
  return (
    <div className="space-y-4">
      <VideoInput label="Video URL" value={videoUrl} onChange={setVideoUrl} hint="MP4 only · max 20 MB · max 1024×2048 · 10–2000 frames" />
      <Toggle label="Invert Output" checked={invertOutput} onChange={setInvertOutput} hint="When enabled, isolates the background instead of the subject" />
      <SubmitButton disabled={!videoUrl} loading={loading} credits={240} onClick={() => onSubmit({ videoUrl, invertOutput })} />
    </div>
  );
}

function WatermarkRemoverForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("");
  return (
    <div className="space-y-4">
      <VideoInput label="Video URL" value={videoUrl} onChange={setVideoUrl} hint="Publicly accessible HTTPS URL · max 100 MB" />
      <TextInput label="Duration (seconds, optional)" value={duration} onChange={setDuration} placeholder="Auto-detected" type="number" hint="Leave blank to auto-detect" />
      <SubmitButton disabled={!videoUrl} loading={loading} credits={200} onClick={() => onSubmit({ videoUrl, duration: duration ? Number(duration) : undefined })} />
    </div>
  );
}

function RemoveBgForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [rmbgModel, setRmbgModel] = useState("RMBG-2.0");
  return (
    <div className="space-y-4">
      <ImageUpload label="Image" value={image} onChange={setImage} />
      <SelectInput label="AI Model" value={rmbgModel} onChange={setRmbgModel} options={[
        { value: "RMBG-2.0", label: "RMBG 2.0 (recommended)" },
        { value: "BEN2", label: "BEN2 (best quality)" },
        { value: "RMBG-1.4", label: "RMBG 1.4 (classic)" },
      ]} />
      <SubmitButton disabled={!image} loading={loading} credits={10} onClick={() => onSubmit({ image, rmbgModel })} />
    </div>
  );
}

function SuperResolutionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [scale, setScale] = useState<2 | 4 | 8>(2);
  const [faceEnhance, setFaceEnhance] = useState(false);
  return (
    <div className="space-y-4">
      <ImageUpload label="Image" value={image} onChange={setImage} hint="Max 2048×2048 input" />
      <SelectInput label="Upscale Factor" value={String(scale)} onChange={(v) => setScale(Number(v) as 2 | 4 | 8)} options={[{ value: "2", label: "2× (recommended)" }, { value: "4", label: "4×" }, { value: "8", label: "8× (very large output)" }]} />
      <Toggle label="Face Enhancement" checked={faceEnhance} onChange={setFaceEnhance} hint="Improves faces in the output" />
      <SubmitButton disabled={!image} loading={loading} credits={50} onClick={() => onSubmit({ image, scale, faceEnhance })} />
    </div>
  );
}

function JoyCaptionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [promptStyle, setPromptStyle] = useState("Descriptive");
  const [captionLength, setCaptionLength] = useState("any");
  return (
    <div className="space-y-4">
      <ImageUpload label="Image" value={image} onChange={setImage} />
      <SelectInput label="Caption Style" value={promptStyle} onChange={setPromptStyle} options={[
        { value: "Descriptive", label: "Descriptive" },
        { value: "Casual", label: "Casual" },
        { value: "Straightforward", label: "Straightforward" },
        { value: "Stable Diffusion Prompt", label: "Stable Diffusion Prompt" },
        { value: "MidJourney", label: "MidJourney Prompt" },
        { value: "Art Critic", label: "Art Critic" },
        { value: "Product Listing", label: "Product Listing" },
        { value: "Social Media Post", label: "Social Media Post" },
      ]} />
      <SelectInput label="Caption Length" value={captionLength} onChange={setCaptionLength} options={[
        { value: "any", label: "Any" },
        { value: "very short", label: "Very Short" },
        { value: "short", label: "Short" },
        { value: "medium", label: "Medium" },
        { value: "long", label: "Long" },
        { value: "very long", label: "Very Long" },
      ]} />
      <SubmitButton disabled={!image} loading={loading} credits={40} onClick={() => onSubmit({ image, promptStyle, captionLength })} />
    </div>
  );
}

function Trellis3DForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  return (
    <div className="space-y-4">
      <ImageUpload label="Image" value={image} onChange={setImage} hint="Max 2048×2048 · Works best with isolated subjects on clean backgrounds" />
      <NumberInput label="Seed (0 = random)" value={seed} onChange={setSeed} min={0} max={2147483647} />
      <SubmitButton disabled={!image} loading={loading} credits={400} onClick={() => onSubmit({ image, seed })} />
    </div>
  );
}

function MusicGenForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [lyricsType, setLyricsType] = useState<"generate" | "user" | "instrumental">("generate");
  const [gptDescriptionPrompt, setGptDescriptionPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [negativeTags, setNegativeTags] = useState("");

  const valid = !!gptDescriptionPrompt.trim() || (lyricsType === "user" && !!lyrics.trim());

  return (
    <div className="space-y-4">
      <SelectInput label="Lyrics Mode" value={lyricsType} onChange={(v) => setLyricsType(v as "generate" | "user" | "instrumental")} options={[
        { value: "generate", label: "AI-Generated Lyrics" },
        { value: "user", label: "My Own Lyrics" },
        { value: "instrumental", label: "Instrumental (No Lyrics)" },
      ]} />
      <TextArea label="Music Description" value={gptDescriptionPrompt} onChange={setGptDescriptionPrompt} placeholder="e.g., Upbeat jazz with saxophone and piano, 1960s style, happy mood..." rows={3} />
      {lyricsType === "user" && (
        <TextArea label="Lyrics" value={lyrics} onChange={setLyrics} placeholder="Verse 1:&#10;..." rows={6} />
      )}
      <TextInput label="Negative Tags (optional)" value={negativeTags} onChange={setNegativeTags} placeholder="e.g., heavy metal, distortion, aggressive" hint="Comma-separated genres or styles to avoid" />
      <SubmitButton disabled={!valid} loading={loading} credits={200} onClick={() => onSubmit({ lyricsType, gptDescriptionPrompt, lyrics: lyricsType === "user" ? lyrics : undefined, negativeTags: negativeTags || undefined })} />
    </div>
  );
}


function AddAudioForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [steps, setSteps] = useState(25);

  const valid = !!videoUrl && !!prompt.trim();

  return (
    <div className="space-y-4">
      <VideoInput label="Video URL" value={videoUrl} onChange={setVideoUrl} hint="MP4 only · max 30 seconds of audio will be generated" />
      <TextArea label="Audio Description" value={prompt} onChange={setPrompt} placeholder="e.g., Footsteps on gravel, birds chirping, gentle breeze..." rows={3} />
      <TextInput label="Negative Prompt (optional)" value={negativePrompt} onChange={setNegativePrompt} placeholder="e.g., music, voice, echo" />
      <NumberInput label="Diffusion Steps" value={steps} onChange={setSteps} min={20} max={50} hint="More steps = higher quality, slower (20–50)" />
      <SubmitButton disabled={!valid} loading={loading} credits={75} onClick={() => onSubmit({ videoUrl, prompt, negativePrompt: negativePrompt || undefined, steps })} />
    </div>
  );
}

function DiffRhythmForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [taskType, setTaskType] = useState<"txt2audio-base" | "txt2audio-full">("txt2audio-base");
  const [lyrics, setLyrics] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [styleAudioUrl, setStyleAudioUrl] = useState("");

  const valid = !!lyrics.trim() && !!stylePrompt.trim();

  return (
    <div className="space-y-4">
      <SelectInput label="Song Length" value={taskType} onChange={(v) => setTaskType(v as "txt2audio-base" | "txt2audio-full")} options={[
        { value: "txt2audio-base", label: "Base (up to 1 min 35 sec)" },
        { value: "txt2audio-full", label: "Full (up to 4 min 45 sec)" },
      ]} />
      <TextArea label="Style Description" value={stylePrompt} onChange={setStylePrompt} placeholder="e.g., melancholic indie pop, soft guitar, female vocals..." rows={2} />
      <TextArea label="Lyrics with Timestamps" value={lyrics} onChange={setLyrics} placeholder={"[00:00.00] Verse 1 line one\n[00:05.00] Verse 1 line two\n[00:10.00] ...\n"} rows={8} hint="Use [MM:SS.xx] timestamp format for each lyric line" />
      <TextInput label="Style Reference Audio URL (optional)" value={styleAudioUrl} onChange={setStyleAudioUrl} placeholder="https://..." type="url" hint="Provide an audio file to use as a style reference" />
      <SubmitButton disabled={!valid} loading={loading} credits={80} onClick={() => onSubmit({ taskType, lyrics, stylePrompt, styleAudioUrl: styleAudioUrl || undefined })} />
    </div>
  );
}

// ─── New tool forms ───────────────────────────────────────────────────────────

function IdeogramCharacterForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState("portrait_4_3");
  const [swapMode, setSwapMode] = useState<"face" | "full">("full");

  const canSubmit = !!targetImage && !!characterImage;

  return (
    <div className="space-y-5">
      {/* Swap mode toggle */}
      <div>
        <Label className="mb-1.5">Swap Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["full", "face"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSwapMode(mode)}
              disabled={loading}
              className={`flex flex-col gap-0.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                swapMode === mode
                  ? "border-[var(--accent-amber)] bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]"
                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="text-sm font-semibold">
                {mode === "full" ? "Full Character" : "Face Only"}
              </span>
              <span className="text-[11px] opacity-70">
                {mode === "full" ? "Body, clothing & face" : "Face & hair only"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Target photo */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Target Photo</Label>
          <InfoTooltip content="The photo containing the person you want to replace. The scene, background, lighting, and pose will be preserved." />
        </div>
        <ImageInput value={targetImage} onChange={setTargetImage} disabled={loading} />
      </div>

      {/* Character to insert */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Character to Insert</Label>
          <InfoTooltip content={swapMode === "full" ? "A full-body photo of the person to swap in. Their face, body, and clothing will be transferred into the target scene." : "A clear photo of the person to swap in. Use a well-lit, front-facing portrait for best face preservation."} />
        </div>
        <ImageInput value={characterImage} onChange={setCharacterImage} disabled={loading} />
      </div>

      {/* Output size */}
      <div>
        <Label className="mb-1.5">Output Size</Label>
        <SelectInput
          value={imageSize}
          onChange={setImageSize}
          options={[
            { value: "portrait_4_3", label: "Portrait 4:3" },
            { value: "portrait_16_9", label: "Portrait 9:16" },
            { value: "square_hd", label: "Square (1:1)" },
            { value: "landscape_4_3", label: "Landscape 4:3" },
            { value: "landscape_16_9", label: "Landscape 16:9" },
          ]}
          disabled={loading}
        />
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ targetImage, characterImage, imageSize, swapMode })}
        disabled={loading || !canSubmit}
        className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Swap Character · 240 cr
      </button>
    </div>
  );
}

function IdeogramCharacterRemixForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.5);
  const [style, setStyle] = useState("AUTO");
  const [renderingSpeed, setRenderingSpeed] = useState("BALANCED");
  const [imageSize, setImageSize] = useState("portrait_4_3");
  const [numImages, setNumImages] = useState(1);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSubmit = !!sourceImage && !!referenceImage && prompt.trim().length > 0;
  const totalCredits = 120 * numImages;
  const isDisabled = loading;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Source Image</Label>
          <InfoTooltip content="The photo you want to remix. This is the base image — its background, scene, or environment will be transformed based on your prompt." />
        </div>
        <ImageInput value={sourceImage} onChange={setSourceImage} disabled={isDisabled} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Character Reference</Label>
          <InfoTooltip content="A photo of the person whose appearance should be preserved in the remix. Use a clear, front-facing portrait for best results." />
        </div>
        <ImageInput value={referenceImage} onChange={setReferenceImage} disabled={isDisabled} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>New Scene Description</Label>
          <InfoTooltip content="Describe what you want the new scene or background to look like. The subject from the character reference will be placed in this new environment." />
        </div>
        <TextArea
          value={prompt}
          onChange={setPrompt}
          placeholder="e.g. change the background to a luxury penthouse, golden hour lighting"
          rows={3}
          disabled={isDisabled}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Change Intensity</Label>
          <InfoTooltip content="How aggressively to transform the image. Lower values make subtle changes (background swap only), higher values more dramatically reshape the scene." />
        </div>
        <SelectInput
          value={String(strength)}
          onChange={(v) => setStrength(Number(v))}
          options={[
            { value: "0.1", label: "0.1 — Very subtle" },
            { value: "0.2", label: "0.2 — Subtle" },
            { value: "0.3", label: "0.3 — Light" },
            { value: "0.4", label: "0.4 — Moderate" },
            { value: "0.5", label: "0.5 — Medium" },
            { value: "0.6", label: "0.6 — Strong" },
            { value: "0.7", label: "0.7 — Very strong" },
            { value: "0.8", label: "0.8 — Dramatic" },
            { value: "0.9", label: "0.9 — Extreme" },
            { value: "1.0", label: "1.0 — Complete" },
          ]}
          disabled={isDisabled}
        />
        <FieldHint>Lower = keep more of the original; higher = allow more change</FieldHint>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">Style</Label>
          <SelectInput
            value={style}
            onChange={setStyle}
            options={[
              { value: "AUTO", label: "Auto" },
              { value: "REALISTIC", label: "Realistic" },
              { value: "FICTION", label: "Fiction" },
            ]}
            disabled={isDisabled}
          />
        </div>
        <div>
          <Label className="mb-1.5">Number of Images</Label>
          <SelectInput
            value={String(numImages)}
            onChange={(v) => setNumImages(Number(v))}
            options={[
              { value: "1", label: "1 image" },
              { value: "2", label: "2 images" },
              { value: "3", label: "3 images" },
              { value: "4", label: "4 images" },
            ]}
            disabled={isDisabled}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5">Output Size</Label>
        <SelectInput
          value={imageSize}
          onChange={setImageSize}
          options={[
            { value: "square_hd", label: "Square HD (1:1)" },
            { value: "portrait_4_3", label: "Portrait 4:3" },
            { value: "portrait_16_9", label: "Portrait 9:16" },
            { value: "landscape_4_3", label: "Landscape 4:3" },
            { value: "landscape_16_9", label: "Landscape 16:9" },
          ]}
          disabled={isDisabled}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
        Advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
          <div>
            <Label className="mb-1.5">Rendering Quality</Label>
            <SelectInput
              value={renderingSpeed}
              onChange={setRenderingSpeed}
              options={[
                { value: "TURBO", label: "Turbo (fastest)" },
                { value: "BALANCED", label: "Balanced" },
                { value: "QUALITY", label: "Quality (best)" },
              ]}
              disabled={isDisabled}
            />
          </div>
          <div>
            <Label className="mb-1.5">Negative Prompt</Label>
            <TextInput
              value={negativePrompt}
              onChange={setNegativePrompt}
              placeholder="What to avoid in the output"
              disabled={isDisabled}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Cost: <span className="font-semibold text-[var(--accent-amber)]">{totalCredits} credits</span>
        {numImages > 1 && ` (${numImages} × 120 cr)`}
      </p>

      <button
        type="button"
        onClick={() => onSubmit({
          sourceImage,
          referenceImage,
          prompt: prompt.trim(),
          strength,
          style,
          renderingSpeed,
          imageSize,
          numImages,
          negativePrompt: negativePrompt.trim() || undefined,
        })}
        disabled={isDisabled || !canSubmit}
        className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Remix Scene · {totalCredits} cr
      </button>
    </div>
  );
}

function RecraftCrispUpscaleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [image, setImage] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>Image to Upscale</Label>
          <InfoTooltip content="Upload any image to enhance its resolution and sharpness. Recraft's crisp upscaling adds fine detail while maintaining natural quality. Best for portraits, characters, and detailed scenes." />
        </div>
        <ImageInput value={image} onChange={setImage} disabled={loading} />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Crisp Upscale enhances your image to a higher resolution with sharpened details. No additional settings are required — the model automatically determines the optimal output quality.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ image })}
        disabled={loading || !image}
        className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Upscale Image · 60 cr
      </button>
    </div>
  );
}

function GrokVideoUpscaleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [sourceTaskId, setSourceTaskId] = useState("");

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-md)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber-glow)] p-4">
        <div className="flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-[var(--accent-amber)]"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            This tool only works with videos generated via <strong className="text-[var(--text-primary)]">Grok Imagine</strong> on KIE.AI. Enter the original KIE.AI task ID from a completed video generation.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <Label>KIE.AI Task ID</Label>
          <InfoTooltip content="Enter the task ID from a previously completed Grok Imagine video generation on KIE.AI. This is the ID returned when the video was originally generated — it looks like 'task_grok_12345678'. Currently only Grok Imagine videos are supported." />
        </div>
        <TextInput
          value={sourceTaskId}
          onChange={setSourceTaskId}
          placeholder="e.g. task_grok_12345678abcdef"
          disabled={loading}
        />
        <FieldHint>The task ID from the original KIE.AI video generation</FieldHint>
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ sourceTaskId: sourceTaskId.trim() })}
        disabled={loading || !sourceTaskId.trim()}
        className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-all hover:bg-[var(--accent-amber-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Upscale Video · 600 cr
      </button>
    </div>
  );
}

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton({
  disabled,
  loading,
  credits,
  onClick,
}: {
  disabled: boolean;
  loading: boolean;
  credits: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-3 text-sm font-semibold text-[#0A0A0B] shadow-[0_0_20px_rgba(232,166,52,0.15)] transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Processing…
        </span>
      ) : (
        `Generate · ${credits.toLocaleString()} credits`
      )}
    </button>
  );
}

// ─── Form router ─────────────────────────────────────────────────────────────

function ToolForm({
  tool,
  onSubmit,
  loading,
}: {
  tool: WorkshopTool;
  onSubmit: (data: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const props = { onSubmit, loading };
  switch (tool.slug) {
    case "photo-face-swap":    return <PhotoFaceSwapForm {...props} />;
    case "multi-face-swap":    return <MultiFaceSwapForm {...props} />;
    case "video-face-swap":    return <VideoFaceSwapForm {...props} />;
    case "virtual-try-on":     return <VirtualTryOnForm {...props} />;
    case "ai-hug":             return <AIHugForm {...props} />;
    case "lipsync":            return <LipsyncForm {...props} />;
    case "effects":            return <KlingEffectsForm {...props} />;
    case "kling-sound":        return <KlingSoundForm {...props} />;
    case "ai-video-edit":      return <AIVideoEditForm {...props} />;
    case "video-remove-bg":    return <VideoRemoveBgForm {...props} />;
    case "watermark-remover":  return <WatermarkRemoverForm {...props} />;
    case "remove-bg":          return <RemoveBgForm {...props} />;
    case "super-resolution":   return <SuperResolutionForm {...props} />;
    case "joycaption":         return <JoyCaptionForm {...props} />;
    case "trellis3d":          return <Trellis3DForm {...props} />;
    case "music-gen":          return <MusicGenForm {...props} />;
    case "add-audio":          return <AddAudioForm {...props} />;
    case "diffrhythm":              return <DiffRhythmForm {...props} />;
    case "character-swap":      return <IdeogramCharacterForm {...props} />;
    case "character-swap-remix": return <IdeogramCharacterRemixForm {...props} />;
    case "recraft-crisp-upscale":   return <RecraftCrispUpscaleForm {...props} />;
    case "grok-video-upscale":      return <GrokVideoUpscaleForm {...props} />;
    default:                        return <p className="text-sm text-[var(--text-muted)]">Coming soon.</p>;
  }
}

// ─── Result display ───────────────────────────────────────────────────────────

type PollResult = {
  status: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  audioUrl?: string | null;
  audioUrls?: string[] | null;
  text?: string | null;
  modelUrl?: string | null;
  songId?: string | null;
  errorMessage?: string | null;
};

function ResultDisplay({
  status,
  result,
  error,
  outputType,
}: {
  status: "idle" | "loading" | "polling" | "done" | "error";
  result: PollResult | null;
  error: string | null;
  outputType: OutputType;
}) {
  const [copied, setCopied] = useState(false);

  const copyText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  if (status === "idle") {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">Result will appear here</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Fill out the form and click Generate</p>
      </div>
    );
  }

  if (status === "loading" || status === "polling") {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 text-center">
        <svg className="mb-3 animate-spin text-[var(--accent-amber)]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {status === "loading" ? "Submitting…" : "Generating…"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {status === "polling" ? "This can take 30 seconds to a few minutes" : "Sending to API…"}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--error)]/30 bg-[var(--bg-surface)] px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">Generation failed</p>
        <p className="mt-1 text-xs text-[var(--error)]">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  // ── Video ──
  if (result.videoUrl) {
    return (
      <div className="space-y-3">
        <video
          src={result.videoUrl}
          controls
          playsInline
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-black"
        />
        <DownloadButton url={result.videoUrl} filename="workshop-output.mp4" fullWidth />
      </div>
    );
  }

  // ── Single image ──
  if (result.imageUrl && outputType !== "multi-image") {
    return (
      <div className="space-y-3">
        <img src={result.imageUrl} alt="Result" className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)]" />
        <DownloadButton url={result.imageUrl} filename="workshop-output.png" fullWidth />
      </div>
    );
  }

  // ── Multiple images (virtual try-on) ──
  if (result.imageUrls?.length) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {result.imageUrls.map((url, i) => (
            <img key={i} src={url} alt={`Result ${i + 1}`} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)]" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {result.imageUrls.map((url, i) => (
            <DownloadButton key={i} url={url} filename={`workshop-output-${i + 1}.png`} label={`Download ${i + 1}`} />
          ))}
        </div>
      </div>
    );
  }

  // ── Multiple audio variants (Kling Sound) ──
  if (result.audioUrls?.length) {
    return (
      <div className="space-y-3">
        {result.audioUrls.map((url, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Variation {i + 1}</p>
            <audio src={url} controls className="w-full" />
            <DownloadButton url={url} filename={`workshop-sound-${i + 1}.mp3`} label="Download" className="mt-2" />
          </div>
        ))}
      </div>
    );
  }

  // ── Single audio ──
  if (result.audioUrl) {
    return (
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <audio src={result.audioUrl} controls className="w-full" />
        <DownloadButton url={result.audioUrl} filename="workshop-audio.mp3" />
        {result.songId && <InlineSongExtend songId={result.songId} />}
      </div>
    );
  }

  // ── Text (JoyCaption) ──
  if (result.text) {
    return (
      <div className="space-y-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">{result.text}</p>
        </div>
        <button
          onClick={() => copyText(result.text!)}
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
        >
          {copied ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Copied!</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy Caption</>
          )}
        </button>
      </div>
    );
  }

  // ── 3D model ──
  if (result.modelUrl) {
    return (
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">3D Model Ready</p>
        <p className="text-xs text-[var(--text-muted)]">GLB format — open in any 3D viewer</p>
        <DownloadButton url={result.modelUrl} filename="workshop-model.glb" label="Download GLB" />
      </div>
    );
  }

  return (
    <div className="flex h-40 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <p className="text-sm text-[var(--text-muted)]">Completed — no output URL received</p>
    </div>
  );
}

function InlineSongExtend({ songId }: { songId: string }) {
  const [open, setOpen] = useState(false);
  const [continueAt, setContinueAt] = useState(30);
  const [prompt, setPrompt] = useState("");
  const [lyricsType, setLyricsType] = useState<"generate" | "user" | "instrumental">("generate");
  const [lyrics, setLyrics] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "polling" | "done" | "error">("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [extendedAudioUrl, setExtendedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || status !== "polling") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workshop/poll?taskId=${taskId}`);
        const data = await res.json();
        if (data.status === "completed") {
          setExtendedAudioUrl(data.audioUrl);
          setStatus("done");
        } else if (data.status === "failed") {
          setError(data.errorMessage || "Extension failed");
          setStatus("error");
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId, status]);

  const handleExtend = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/workshop/song-extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          continueSongId: songId,
          continueAt,
          prompt,
          lyricsType,
          lyrics: lyricsType === "user" ? lyrics : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setTaskId(data.taskId);
      setStatus("polling");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  };

  const isActive = status === "loading" || status === "polling";

  return (
    <div className="border-t border-[var(--border-subtle)] pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Extend This Song
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Extend This Song</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              Cancel
            </button>
          </div>
          <NumberInput label="Continue At (seconds)" value={continueAt} onChange={setContinueAt} min={0} hint="Timestamp in the original song where extension begins" />
          <TextArea label="Style / Description (optional)" value={prompt} onChange={setPrompt} placeholder="Continue the melody with a bridge section..." rows={2} />
          <SelectInput
            label="Lyrics Mode"
            value={lyricsType}
            onChange={(v) => setLyricsType(v as "generate" | "user" | "instrumental")}
            options={[
              { value: "generate", label: "AI-Generated Lyrics" },
              { value: "user", label: "My Own Lyrics" },
              { value: "instrumental", label: "Instrumental" },
            ]}
          />
          {lyricsType === "user" && (
            <TextArea label="Continuation Lyrics" value={lyrics} onChange={setLyrics} placeholder={"Bridge:\n..."} rows={4} />
          )}
          {status === "error" && <p className="text-xs text-[var(--error)]">{error}</p>}
          <button
            type="button"
            disabled={isActive}
            onClick={handleExtend}
            className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] py-2.5 text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isActive ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {status === "loading" ? "Submitting…" : "Extending…"}
              </span>
            ) : (
              "Extend · 200 credits"
            )}
          </button>
          {status === "done" && extendedAudioUrl && (
            <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/20 bg-[var(--bg-elevated)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">Extended</p>
              <audio src={extendedAudioUrl} controls className="w-full" />
              <DownloadButton url={extendedAudioUrl} filename="workshop-extended.mp3" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadButton({
  url,
  filename,
  label = "Download",
  className = "",
  fullWidth = false,
}: {
  url: string;
  filename: string;
  label?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(url)}`;
    a.download = filename;
    a.click();
  };

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-amber)]/40 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] ${fullWidth ? "w-full" : ""} ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </button>
  );
}

// ─── Category badge colours ───────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  face:  "bg-purple-500/10 text-purple-300",
  video: "bg-blue-500/10 text-blue-300",
  image: "bg-emerald-500/10 text-emerald-300",
  audio: "bg-rose-500/10 text-rose-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  face: "Face & Identity",
  video: "Video Tools",
  image: "Image Utilities",
  audio: "Audio & Music",
};

// ─── Main page shell ─────────────────────────────────────────────────────────

export function WorkshopToolPageClient({
  tool,
  totalCredits,
}: {
  tool: WorkshopTool;
  totalCredits: number;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "polling" | "done" | "error">("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for completion
  useEffect(() => {
    if (!taskId || status !== "polling") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workshop/poll?taskId=${taskId}`);
        const data: PollResult & { status: string } = await res.json();
        if (data.status === "completed") {
          setResult(data);
          setStatus("done");
        } else if (data.status === "failed") {
          setError(data.errorMessage || "Generation failed");
          setStatus("error");
        }
        // pending / processing → keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId, status]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/workshop/${tool.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setTaskId(data.taskId);
      setStatus("polling");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  };

  const isActive = status === "loading" || status === "polling";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link href="/workshop" className="transition-colors hover:text-[var(--text-primary)]">
          Workshop
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--text-secondary)]">{tool.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_STYLES[tool.category]}`}>
            {CATEGORY_LABELS[tool.category]}
          </span>
          {tool.status === "beta" && (
            <span className="rounded-full bg-[var(--accent-amber)]/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
              Beta
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">{tool.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{tool.description}</p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          {tool.creditLabel} · {totalCredits.toLocaleString()} credits available
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form panel */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Inputs
          </h2>
          <ToolForm tool={tool} onSubmit={handleSubmit} loading={isActive} />
        </div>

        {/* Result panel */}
        <div className="self-start rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Result
            </h2>
            {status === "done" && (
              <button
                onClick={() => { setStatus("idle"); setResult(null); setTaskId(null); }}
                className="text-[10px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
              >
                Clear
              </button>
            )}
          </div>
          <ResultDisplay status={status} result={result} error={error} outputType={tool.outputType} />
        </div>
      </div>
    </div>
  );
}
