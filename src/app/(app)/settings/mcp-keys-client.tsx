"use client";

import { useEffect, useState } from "react";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

interface NewKeyResponse {
  key: ApiKeyRow & { raw: string };
  notice: string;
}

export function McpKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealed, setRevealed] = useState<NewKeyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/settings/mcp-keys");
      if (!res.ok) throw new Error("Failed to load keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    const name = newKeyName.trim();
    if (!name) {
      setError("Give the key a name (e.g. 'Claude Desktop')");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/mcp-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create key");
      setRevealed(data as NewKeyResponse);
      setNewKeyName("");
      fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key? Any MCP client using it will stop working immediately.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/settings/mcp-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke");
      }
      fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  };

  const copyKey = (raw: string) => {
    navigator.clipboard.writeText(raw).catch(() => {});
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          MCP API Keys
        </h2>
        <a
          href="/docs/mcp"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
        >
          Install guide ↗
        </a>
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Connect Claude Desktop, Claude Code, or any MCP client to Artifacial. Each key authenticates
        a single client and bills generations to your account. Treat them like passwords.
      </p>

      {/* Reveal-once banner after creation */}
      {revealed && (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/5 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
            New key — copy now, never shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/40 px-2 py-1.5 font-mono text-[11px] text-[var(--text-primary)]">
              {revealed.key.raw}
            </code>
            <button
              onClick={() => copyKey(revealed.key.raw)}
              className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
            >
              Copy
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="mb-5 flex gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. Claude Desktop)"
          maxLength={80}
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-amber)] focus:outline-none"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newKeyName.trim()}
          className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90"
        >
          {creating ? "Generating…" : "Generate key"}
        </button>
      </div>

      {error && <p className="mb-4 text-[12px] text-red-400">{error}</p>}

      {/* Key list */}
      {loading ? (
        <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">No keys yet. Create one above to connect Claude.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{k.name}</p>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">
                  {k.prefix}…  · created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · never used"}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-[11px] text-red-400/80 hover:text-red-400"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
