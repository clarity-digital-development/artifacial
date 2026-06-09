/**
 * Server-side fetch helper for user-supplied URLs. Hardened against SSRF.
 *
 * - Validates the URL parses and uses http/https only.
 * - Resolves the hostname via DNS and rejects ANY result in a private,
 *   loopback, link-local, or IPv6-local range (incl. cloud metadata at
 *   169.254.169.254 and the IPv4-mapped form ::ffff:127.0.0.1).
 * - Manual redirect handling — re-validates each Location header against
 *   the same allow-list before following.
 * - Hard caps: max bytes (50 MB by default), max redirects (3), timeout
 *   (30 s) so a malicious URL can't exhaust memory or block the worker.
 *
 * Use this anywhere a user can pass a URL that the server will then fetch
 * (Virality Predictor, future video-import flows, etc.). For URLs we
 * generated ourselves (PiAPI / KIE.AI / R2-signed), plain `fetch` is fine.
 *
 * Known residual gap: DNS rebinding. Between our pre-flight DNS lookup and
 * Node's TCP connect, a hostile DNS server could swap the address back to a
 * private IP. Defeating that requires pinning to the validated IP after
 * resolution and passing `Host:` manually, which would require either a
 * custom dispatcher / undici Agent or an http(s).Agent with `lookup` override.
 * Out of scope for v1 — the current pre-flight block stops the easy SSRF
 * surface (direct IP literals, public DNS-A records that point at private IPs).
 */

import { lookup } from "dns/promises";
import net from "net";

// ─── Private / unsafe range checks ───────────────────────────────────────────

const PRIVATE_V4_PREFIXES = [
  /^0\./,            // 0.0.0.0/8 — "this network"
  /^10\./,           // RFC1918
  /^127\./,          // 127.0.0.0/8 — loopback
  /^192\.168\./,     // RFC1918
  /^169\.254\./,     // link-local — incl. AWS/GCP/Azure IMDS at 169.254.169.254
  /^224\./,          // multicast
  /^255\.255\.255\.255$/, // broadcast
];

function is172Private(ip: string): boolean {
  // 172.16.0.0/12 — RFC1918
  const m = ip.match(/^172\.(\d+)\./);
  if (!m) return false;
  const second = Number(m[1]);
  return second >= 16 && second <= 31;
}

function isPrivateIPv4(ip: string): boolean {
  return PRIVATE_V4_PREFIXES.some((re) => re.test(ip)) || is172Private(ip);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::1") return true;
  if (lower === "::") return true;
  // ULA: fc00::/7 (fc/fd)
  if (/^f[cd]/.test(lower)) return true;
  // Link-local: fe80::/10
  if (/^fe[89ab]/.test(lower)) return true;
  // Multicast: ff00::/8
  if (lower.startsWith("ff")) return true;
  // IPv4-mapped — check the v4 portion (e.g. ::ffff:127.0.0.1)
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

// ─── URL validation ──────────────────────────────────────────────────────────

/**
 * Parse + validate a URL. Throws on private / loopback / link-local targets.
 * Returns the parsed URL on success.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("URL must use http or https");
  }

  // Strip brackets from IPv6 host
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // Direct IP — validate without DNS
  const ipFam = net.isIP(hostname);
  if (ipFam === 4) {
    if (isPrivateIPv4(hostname)) throw new Error("URL targets a private network");
    return url;
  }
  if (ipFam === 6) {
    if (isPrivateIPv6(hostname)) throw new Error("URL targets a private network");
    return url;
  }

  // Hostname — resolve DNS and validate every returned record
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve hostname");
  }
  if (records.length === 0) throw new Error("Hostname has no IP addresses");

  for (const r of records) {
    if (r.family === 4 && isPrivateIPv4(r.address)) {
      throw new Error("Hostname resolves to a private network");
    }
    if (r.family === 6 && isPrivateIPv6(r.address)) {
      throw new Error("Hostname resolves to a private network");
    }
  }
  return url;
}

// ─── Hardened fetch ──────────────────────────────────────────────────────────

export interface SafeFetchOptions {
  /** Max total bytes to download. Default 50 MB. */
  maxBytes?: number;
  /** Max redirects to follow (each re-validated). Default 3. */
  maxRedirects?: number;
  /** Per-attempt timeout in milliseconds. Default 30 s. */
  timeoutMs?: number;
  /** Override user-agent. Default "Artifacial-Bot/1.0". */
  userAgent?: string;
  /** Additional request headers — useful for browser-shape requests when WAFs
   *  fingerprint on Accept / Accept-Language / Accept-Encoding. */
  headers?: Record<string, string>;
}

/**
 * Fetch a user-supplied URL with SSRF protection + size/redirect/time caps.
 * Returns the response body as a Buffer.
 */
export async function safeFetchUserUrl(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<Buffer> {
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const userAgent = opts.userAgent ?? "Artifacial-Bot/1.0";

  let current = await assertPublicUrl(rawUrl);
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": userAgent, ...(opts.headers ?? {}) },
      });
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect handling — re-validate every Location target
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect with no Location header");
      if (redirects >= maxRedirects) throw new Error("Too many redirects");
      redirects++;
      const nextUrl = new URL(loc, current);
      current = await assertPublicUrl(nextUrl.toString());
      continue;
    }

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    // Reject content-length over cap upfront (cheap path)
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const len = parseInt(lenHeader, 10);
      if (Number.isFinite(len) && len > maxBytes) {
        throw new Error(`Content exceeds ${maxBytes} byte limit (header says ${len})`);
      }
    }

    // Stream into a capped buffer — protects against missing/lying content-length
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Response has no body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`Content exceeded ${maxBytes} byte limit`);
      }
      chunks.push(value);
    }

    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
}
