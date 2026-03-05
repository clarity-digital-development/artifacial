"use client";

import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  preview?: string | null;
  accept?: string;
  className?: string;
}

export function UploadZone({
  onFile,
  preview,
  accept = "image/jpeg,image/png,image/webp",
  className = "",
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  if (preview) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <div className="relative h-40 w-40 overflow-hidden rounded-full border-2 border-[var(--border-default)]">
          <img
            src={preview}
            alt="Upload preview"
            className="h-full w-full object-cover"
          />
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 hover:opacity-100">
            <span className="text-[var(--text-sm)] font-medium text-white">
              Change
            </span>
            <input
              type="file"
              accept={accept}
              onChange={handleChange}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-8 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isDragging
          ? "border-[var(--accent-amber)] bg-[var(--accent-amber-glow)]"
          : "border-[var(--border-default)] hover:border-[var(--accent-amber)] hover:bg-[var(--accent-amber-glow)]"
      } ${className}`}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--text-muted)]"
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">
        Drop a photo here or click to upload
      </span>
      <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
        JPG, PNG, or WebP
      </span>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </label>
  );
}
