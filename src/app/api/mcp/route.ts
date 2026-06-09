/**
 * MCP HTTP entry — Streamable HTTP transport (stateless mode).
 *
 * Auth: Bearer API key in the `Authorization` header (afk_live_… format).
 * Generate keys at /settings/api.
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18
 */

import { NextRequest, NextResponse } from "next/server";
import { dispatchMCP, MCP_PROTOCOL_VERSION } from "@/lib/mcp/server";
import { extractBearer, verifyApiKey } from "@/lib/mcp/keys";

export const runtime = "nodejs"; // Prisma + DNS modules — not Edge-compatible.

// ─── Origin allowlist (DNS-rebinding defense per MCP spec) ───────────────────
// Per the spec: "Servers SHOULD validate the Origin header". We accept null
// origin (curl, native MCP clients without browser context) but for any
// browser-set Origin, restrict to the known list.

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // CLI / native MCP clients — no Origin header
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".artifacial.app") ||
      host === "artifacial.app" ||
      host === "claude.ai" ||
      host.endsWith(".claude.ai") ||
      host === "anthropic.com" ||
      host.endsWith(".anthropic.com")
    );
  } catch {
    return false;
  }
}

// ─── POST: all MCP JSON-RPC traffic ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Origin check (DNS rebinding defense)
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  // 2. Bearer auth
  const rawKey = extractBearer(req.headers.get("authorization"));
  if (!rawKey) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized — missing Bearer token" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="artifacial-mcp"',
        },
      },
    );
  }
  const auth = await verifyApiKey(rawKey);
  if (!auth) {
    return new NextResponse(
      JSON.stringify({ error: "Invalid or revoked API key" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="artifacial-mcp", error="invalid_token"',
        },
      },
    );
  }

  // 3. Body parse
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  // 4. MCP-Protocol-Version check (RFC 9728 ish — soft enforcement)
  // The spec says: if header is missing on a non-initialize request, server SHOULD
  // assume "2025-03-26". We accept any version and let `initialize` negotiate.

  // 5. Dispatch — batching not required in 2025-06-18 but we handle single objects only.
  const msg = Array.isArray(body) ? body[0] : body;
  const outcome = await dispatchMCP(msg, auth.userId);

  if (outcome.kind === "accepted") {
    // Notification — no JSON-RPC response body, just HTTP 202
    return new NextResponse(null, {
      status: 202,
      headers: { "MCP-Protocol-Version": MCP_PROTOCOL_VERSION },
    });
  }
  if (outcome.kind === "error") {
    return NextResponse.json({ error: outcome.message }, { status: outcome.status });
  }

  return NextResponse.json(outcome.body, {
    status: 200,
    headers: { "MCP-Protocol-Version": MCP_PROTOCOL_VERSION },
  });
}

// ─── GET / DELETE: stateless mode rejects ────────────────────────────────────

export async function GET() {
  return new NextResponse("Method Not Allowed — this MCP server is stateless. Use POST.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function DELETE() {
  return new NextResponse("Method Not Allowed — no session state to terminate.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
