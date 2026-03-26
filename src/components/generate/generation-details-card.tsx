"use client";

type GenerationDetailsCardProps = {
  prompt: string;
  modelName: string;
  durationSec: number;
  resolution?: string;
  withAudio: boolean;
  creditCost: number;
  status: "submitting" | "queued" | "processing" | "completed" | "failed";
  errorMessage?: string;
  createdAt: number;
  generationTimeMs?: number;
  outputUrl?: string;
  onRegenerate?: () => void;
  onDownload?: () => void;
};

export function GenerationDetailsCard({
  prompt,
  modelName,
  durationSec,
  resolution,
  withAudio,
  creditCost,
  status,
  errorMessage,
  createdAt,
  generationTimeMs,
  outputUrl,
  onRegenerate,
  onDownload,
}: GenerationDetailsCardProps) {
  const time = new Date(createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-4 mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 md:mx-0">
      {/* Prompt */}
      <p className="text-sm text-[var(--text-secondary)]">{prompt}</p>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>{modelName}</span>
        <span>&middot;</span>
        {resolution && (
          <>
            <span>{resolution}</span>
            <span>&middot;</span>
          </>
        )}
        <span>{durationSec}s</span>
        <span>&middot;</span>
        <span>Audio: {withAudio ? "Yes" : "No"}</span>
        <span>&middot;</span>
        <span className="text-[var(--accent-amber)]">{creditCost.toLocaleString()} cr</span>
        {generationTimeMs && (
          <>
            <span>&middot;</span>
            <span>{(generationTimeMs / 1000).toFixed(1)}s</span>
          </>
        )}
        <span>&middot;</span>
        <span>{time}</span>
      </div>

      {/* Error */}
      {status === "failed" && errorMessage && (
        <p className="mt-2 text-xs text-[var(--error)]">{errorMessage}</p>
      )}

      {/* Actions */}
      {status === "completed" && (
        <div className="mt-3 flex gap-2">
          {outputUrl && onDownload && (
            <button
              onClick={onDownload}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Download
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
