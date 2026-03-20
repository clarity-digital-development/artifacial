"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// ─── Profile Section ───

interface ProfileSectionProps {
  initialName: string;
  email: string;
  image: string | null;
}

export function ProfileSection({ initialName, email, image }: ProfileSectionProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== initialName;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Profile
      </h2>
      <div className="flex items-start gap-4">
        {image ? (
          <img
            src={image}
            alt={initialName}
            className="h-14 w-14 rounded-full ring-2 ring-[var(--border-default)]"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-lg font-medium text-[var(--text-secondary)] ring-2 ring-[var(--border-default)]">
            {initialName?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <div className="flex-1 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-amber)]"
              />
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="h-9 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 text-sm font-medium text-[#0A0A0B] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
            </div>
            {error && (
              <p className="mt-1 text-xs text-[var(--error)]">{error}</p>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{email}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Danger Zone Section ───

export function DangerZoneSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete account");
      }
      // Account deleted — sign out and redirect
      signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-red-500/20 bg-[var(--bg-surface)] p-6">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-red-400">
        Danger Zone
      </h2>

      {!showConfirm ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Delete Account
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Permanently delete your account, characters, and all generated content.
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-[var(--radius-md)] border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Delete account
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            This action is irreversible. Your subscription will be cancelled, credits forfeited, and all data permanently removed.
          </p>
          <p className="mt-3 text-sm text-[var(--text-primary)]">
            Type <span className="font-mono font-semibold text-red-400">DELETE</span> to confirm:
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className="h-9 w-32 rounded-[var(--radius-md)] border border-red-500/30 bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-red-500"
            />
            <button
              onClick={handleDelete}
              disabled={confirmation !== "DELETE" || deleting}
              className="h-9 rounded-[var(--radius-md)] bg-red-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmation("");
                setError(null);
              }}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-[var(--error)]">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
