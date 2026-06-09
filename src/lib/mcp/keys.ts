/**
 * MCP API key issuance + verification.
 *
 * Format: `afk_live_<32 url-safe base64 chars>` — modeled on Stripe's restricted
 * keys. We store only `sha256(rawKey)` (`hash`) and the first 16 chars
 * (`prefix`) in the DB. The raw key is shown to the user exactly once.
 *
 * Lookup is constant-cost on the hash index; tokens are not present in the DB
 * in plaintext, so a leaked DB dump cannot be used to call the MCP server.
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

const KEY_PREFIX = "afk_live_";
const SECRET_BYTES = 24; // → 32 chars base64url

export interface NewApiKey {
  /** The raw secret — SHOW ONCE, never persisted. */
  raw: string;
  /** Public prefix shown in lists / audit logs. First 16 chars of `raw`. */
  prefix: string;
}

/** Generate a fresh raw key + its display prefix. */
export function generateApiKey(): NewApiKey {
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const raw = `${KEY_PREFIX}${secret}`;
  return { raw, prefix: raw.slice(0, 16) };
}

/** Compute the hex sha256 of a raw key. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Look up a raw Bearer token. Returns the owning userId on a valid, non-revoked
 * key, else null. Updates `lastUsedAt` opportunistically.
 *
 * Constant-time hash comparison protects against a timing oracle even though
 * we look up by hash equality at the DB layer.
 */
export async function verifyApiKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  if (typeof rawKey !== "string" || !rawKey.startsWith(KEY_PREFIX)) return null;
  const hash = hashApiKey(rawKey);

  const row = await prisma.apiKey.findUnique({
    where: { hash },
    select: { id: true, userId: true, hash: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;

  // Defense in depth — confirm the hash matches in constant time.
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(row.hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort lastUsedAt update — don't block the request on it.
  prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: row.userId, keyId: row.id };
}

/** Extract the raw token from an `Authorization` header value. */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
