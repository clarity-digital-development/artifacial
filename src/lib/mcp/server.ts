/**
 * Minimal stateless MCP server. Implements the Streamable HTTP transport at the
 * JSON-RPC layer — `initialize`, `notifications/initialized`, `ping`,
 * `tools/list`, `tools/call`. No SSE, no session management.
 *
 * Spec reference: https://modelcontextprotocol.io/specification/2025-06-18
 * Transport: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http
 */

import { listMCPTools, callMCPTool } from "./tools";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-06-18", "2025-03-26"]);

const SERVER_INFO = {
  name: "artifacial-mcp",
  title: "Artifacial",
  version: "0.1.0",
};

const SERVER_CAPABILITIES = {
  tools: {}, // We don't emit `listChanged` notifications — keep stateless.
};

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function rpcResult(id: string | number | null, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: string | number | null, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

// ─── Method handlers ─────────────────────────────────────────────────────────

async function handleInitialize(params: Record<string, unknown> | undefined) {
  const clientVersion = typeof params?.protocolVersion === "string" ? params.protocolVersion : undefined;
  // Echo the client's version if we support it, otherwise advertise our latest.
  const negotiated =
    clientVersion && SUPPORTED_PROTOCOL_VERSIONS.has(clientVersion) ? clientVersion : MCP_PROTOCOL_VERSION;

  return {
    protocolVersion: negotiated,
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO,
    instructions:
      "Artifacial — AI character + video creation. Use list_workshop_tools to discover the catalog, get_credits to see balance, analyze_video_virality for instant viral scoring, or any of the per-job tools (remove_image_background, upscale_image_recraft, upscale_image_topaz). Async jobs return a generationId — poll with get_generation.",
  };
}

async function handleToolsList() {
  return { tools: listMCPTools() };
}

async function handleToolsCall(params: Record<string, unknown> | undefined, userId: string) {
  const name = typeof params?.name === "string" ? params.name : null;
  if (!name) return { error: rpcError(0, -32602, "Missing required parameter: name") };

  const args = (params?.arguments as Record<string, unknown> | undefined) ?? {};
  const result = await callMCPTool(name, userId, args);
  if (!result) return { error: rpcError(0, -32602, `Unknown tool: ${name}`) };
  return { result };
}

// ─── Public dispatcher ───────────────────────────────────────────────────────

export type RpcOutcome =
  | { kind: "response"; body: RpcResponse }
  | { kind: "accepted" } // notification — return HTTP 202 with no body
  | { kind: "error"; status: number; message: string }; // protocol-level HTTP error

/**
 * Dispatch a single JSON-RPC message. Caller supplies the authenticated userId.
 * Returns one of:
 *  - `{ kind: "response", body }` — emit JSON body with HTTP 200
 *  - `{ kind: "accepted" }`       — emit HTTP 202 with no body (notification)
 *  - `{ kind: "error", … }`       — emit HTTP error (auth/parse failures)
 */
export async function dispatchMCP(msg: unknown, userId: string): Promise<RpcOutcome> {
  if (!msg || typeof msg !== "object") {
    return { kind: "response", body: rpcError(null, -32700, "Parse error: message is not an object") };
  }
  const req = msg as Partial<RpcRequest>;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return { kind: "response", body: rpcError(req.id ?? null, -32600, "Invalid Request") };
  }

  // Notification — no `id`. Per spec, fire-and-forget. HTTP layer returns 202.
  const isNotification = req.id === undefined || req.id === null;

  if (isNotification) {
    // The only notification we care about is `notifications/initialized` — pure ack.
    // We silently accept any notification (per JSON-RPC, server MUST NOT respond).
    return { kind: "accepted" };
  }

  const id = req.id as string | number;

  try {
    switch (req.method) {
      case "initialize": {
        const result = await handleInitialize(req.params);
        return { kind: "response", body: rpcResult(id, result) };
      }
      case "ping":
        return { kind: "response", body: rpcResult(id, {}) };
      case "tools/list": {
        const result = await handleToolsList();
        return { kind: "response", body: rpcResult(id, result) };
      }
      case "tools/call": {
        const out = await handleToolsCall(req.params, userId);
        if (out.error) {
          // Re-stamp the id since handleToolsCall returned an id=0 placeholder.
          return { kind: "response", body: rpcError(id, out.error.error!.code, out.error.error!.message) };
        }
        return { kind: "response", body: rpcResult(id, out.result) };
      }
      default:
        return { kind: "response", body: rpcError(id, -32601, `Method not found: ${req.method}`) };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mcp] internal error in ${req.method}:`, message);
    return { kind: "response", body: rpcError(id, -32603, "Internal error") };
  }
}
