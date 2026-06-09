I have enough now to write the guide. (Ignoring the TodoWrite reminder — single-deliverable research task.)

---

# MCP Streamable HTTP Server — Implementation Guide for Next.js 16 App Router

Target spec revision: **`2025-06-18`** (current latest). All citations link to that revision.

---

## 1. Transport — Streamable HTTP

Per the spec ([transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http)):

> "The server **MUST** provide a single HTTP endpoint path (hereafter referred to as the **MCP endpoint**) that supports both POST and GET methods. For example, this could be a URL like `https://example.com/mcp`."

**Endpoint:** A single path (e.g. `/api/mcp`). Same path handles:

| Method | Purpose | Required? |
|---|---|---|
| `POST` | All client → server JSON-RPC messages (requests, notifications, responses) | **MUST** support |
| `GET` | Optional client-initiated SSE stream for server → client messages outside of a request | MAY return `405` if not supported |
| `DELETE` | Client-initiated session termination (sends `Mcp-Session-Id`) | MAY return `405` if not supported |

**Required headers on every client POST:**
- `Accept: application/json, text/event-stream` (client **MUST** list both)
- `Content-Type: application/json`
- `MCP-Protocol-Version: 2025-06-18` (required on every request *after* initialize; if missing, server **SHOULD** assume `2025-03-26`; if invalid, server **MUST** return `400`)
- `Mcp-Session-Id: <id>` (only if server assigned one in `InitializeResult`)
- `Authorization: Bearer <token>` (if auth is required)

**POST response shape — exactly one of these, depending on body type:**

1. Body is a JSON-RPC **request** (has `id`):
   - Server **MUST** respond with either `Content-Type: application/json` (one JSON object) **or** `Content-Type: text/event-stream` (SSE stream that eventually emits the JSON-RPC response as an SSE event, then closes). Client must support both.
2. Body is a JSON-RPC **notification** or **response** (no `id` needing reply):
   - Server **MUST** return `202 Accepted` with **no body**. On rejection, return `4xx` with optional id-less JSON-RPC error.

**GET (SSE upgrade) rules:**
- Client sends `GET /mcp` with `Accept: text/event-stream`.
- Server **MUST** respond with either `Content-Type: text/event-stream` (open stream) or `405 Method Not Allowed`.
- On the GET stream the server **MUST NOT** send JSON-RPC *responses* (only requests/notifications), unless resuming a stream via `Last-Event-ID` header.

**Resumability:** Server **MAY** attach `id:` to SSE events. Client resumes with `Last-Event-ID` header on GET.

**Security (mandatory):**
- Validate `Origin` header (DNS rebinding defense) — **MUST**.
- Localhost bind for local dev — **SHOULD**.
- Auth on all connections — **SHOULD**.

Source: [Streamable HTTP transport spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http).

---

## 2. JSON-RPC Methods You MUST Implement

JSON-RPC 2.0 wire format throughout. For a minimal compliant **tools-only** server:

| Method | Type | Status | Notes |
|---|---|---|---|
| `initialize` | request | **MUST** | First message; version + capability negotiation |
| `notifications/initialized` | notification | **MUST** receive | Client sends after init success; respond `202 Accepted` |
| `tools/list` | request | **MUST** if `tools` capability declared | Returns array of tools (supports cursor pagination) |
| `tools/call` | request | **MUST** if `tools` capability declared | Returns `content[]` + `isError` |
| `ping` | request | **SHOULD** | Standard JSON-RPC request; respond `result: {}`. ([ping spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/ping)) |
| `notifications/cancelled` | notification | **SHOULD** handle | `params: { requestId, reason? }`. Stop work, free resources, **do not** send a response. `initialize` **MUST NOT** be cancelled. ([cancellation spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation)) |
| `notifications/tools/list_changed` | notification (server→client) | only if `listChanged: true` | Emit when tool list mutates |

You only declare capabilities you implement — if you skip `prompts`, `resources`, `logging`, `completions`, you don't need to handle their methods. (See [lifecycle: capability negotiation](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#capability-negotiation).)

Standard JSON-RPC errors apply: `-32700` parse error, `-32600` invalid request, `-32601` method not found, `-32602` invalid params, `-32603` internal error.

---

## 3. Initialize Handshake — Exact JSON

Source: [lifecycle spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#initialization).

**Client → server (request):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
    },
    "clientInfo": {
      "name": "ExampleClient",
      "title": "Example Client Display Name",
      "version": "1.0.0"
    }
  }
}
```

Required client params: `protocolVersion` (string), `capabilities` (object), `clientInfo` (`{ name, version }`; `title` optional).

**Server → client (response):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "ExampleServer",
      "title": "Example Server Display Name",
      "version": "1.0.0"
    },
    "instructions": "Optional instructions for the client"
  }
}
```

Required server result fields: `protocolVersion`, `capabilities`, `serverInfo` (`{ name, version }`). `instructions` and `title` are optional.

**Capability sub-fields:**
- `tools.listChanged: boolean` — server emits `notifications/tools/list_changed`
- `resources.subscribe: boolean`, `resources.listChanged: boolean`
- `prompts.listChanged: boolean`
- `logging: {}` — server can emit `notifications/message`
- `completions: {}` — server supports `completion/complete`
- Client side: `roots`, `sampling`, `elicitation`, `experimental`

**Then** client **MUST** send (no id, fire-and-forget):

```json
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

Server replies `202 Accepted` (no body) over HTTP.

**Version negotiation rule** (verbatim):
> "If the server supports the requested protocol version, it **MUST** respond with the same version. Otherwise, the server **MUST** respond with another protocol version it supports. This **SHOULD** be the latest version supported by the server. If the client does not support the version in the server's response, it **SHOULD** disconnect."

If the server emits an `Mcp-Session-Id` header on the `InitializeResult` response, it has opted into sessions; the client must echo it on every subsequent HTTP request.

---

## 4. Tool Definition Shape (`tools/list`)

Source: [tools spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#data-types).

A single tool object:

```json
{
  "name": "get_weather",
  "title": "Weather Information Provider",
  "description": "Get current weather information for a location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "location": { "type": "string", "description": "City name or zip code" }
    },
    "required": ["location"]
  },
  "outputSchema": { "type": "object", "properties": { /* ... */ }, "required": [/* ... */] },
  "annotations": { /* optional behavior hints — clients MUST treat as untrusted */ }
}
```

Required: `name`, `inputSchema`. Optional: `title`, `description`, `outputSchema`, `annotations`.

**`inputSchema` JSON Schema flavor:** The spec doesn't pin a draft number. In practice the [official schema](https://github.com/modelcontextprotocol/specification/blob/main/schema/2025-06-18/schema.ts) and SDKs (TypeScript SDK uses Zod → JSON Schema via `zodToJsonSchema`) emit and accept **JSON Schema Draft 2020-12 compatible** documents, with the constraint that the top level **MUST** be `{ "type": "object", "properties": {...}, "required": [...] }`. Avoid draft-specific features that don't round-trip cleanly (e.g. `$dynamicRef`); stick to the common subset: `type`, `properties`, `required`, `enum`, `items`, `description`, `format`, `default`, `additionalProperties`, `oneOf/anyOf`. Claude/most clients will pass this directly to the LLM as a tool schema, so keep it concise and well-described.

`tools/list` response also supports `nextCursor` for pagination — opaque string the client passes back in `params.cursor`.

---

## 5. `tools/call` Response Shape

Source: [tools spec — Tool Result](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result).

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [ /* one or more blocks, see below */ ],
    "structuredContent": { /* optional JSON object validating against outputSchema */ },
    "isError": false
  }
}
```

`content` is an array; each item is one of these discriminated unions:

```jsonc
// Text
{ "type": "text", "text": "..." }

// Image (base64)
{ "type": "image", "data": "<base64>", "mimeType": "image/png", "annotations": {...} }

// Audio (base64)
{ "type": "audio", "data": "<base64>", "mimeType": "audio/wav" }

// Resource link (URI reference, not embedded)
{ "type": "resource_link", "uri": "file:///path", "name": "main.rs",
  "description": "...", "mimeType": "text/x-rust", "annotations": {...} }

// Embedded resource (inlined)
{ "type": "resource",
  "resource": { "uri": "file:///path", "mimeType": "text/x-rust",
                "text": "fn main(){}", "annotations": {...} } }
```

**`isError` semantics — important:**
- `isError: true` = **tool execution** failed (API error, bad input). Still returns a normal JSON-RPC `result`. The LLM sees the error text and can react.
- For **protocol** errors (unknown tool, malformed args), return a JSON-RPC `error` object with code `-32602` instead. Don't conflate the two.

If you provide `outputSchema`, you **MUST** populate `structuredContent` matching it. For backwards-compat, also serialize the JSON into a `text` content block.

---

## 6. Auth

Source: [authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

**The canonical answer:** OAuth 2.1 with the MCP server acting as an OAuth 2.1 **resource server**. Tokens travel in the `Authorization: Bearer <token>` header on **every** HTTP request (spec: "authorization **MUST** be included in every HTTP request from client to server, even if they are part of the same logical session"). Tokens **MUST NOT** appear in query strings.

Required server behavior:
1. Implement **RFC 9728 Protected Resource Metadata** at `/.well-known/oauth-protected-resource` advertising `authorization_servers`.
2. On unauthenticated requests, return `HTTP 401` with a `WWW-Authenticate` header pointing at the resource metadata URL (RFC 9728 §5.1).
3. Validate the bearer token's audience (`aud` claim) — must be your canonical MCP server URI. Reject tokens issued for other resources (no token passthrough).
4. Return `401` for invalid/expired tokens, `403` for insufficient scope, `400` for malformed auth.

Client side: discovers the AS via RFC 8414, registers via RFC 7591 (dynamic client registration, **SHOULD**), runs OAuth 2.1 + PKCE, **MUST** include the `resource` parameter (RFC 8707) with the canonical MCP server URI in both authorize and token requests.

**"Can I just use a static API key / Bearer token?"** The spec is "**OPTIONAL**" overall — auth is not required to be MCP-compliant. But *when* you do auth on HTTP, you **SHOULD** follow this spec. Many production servers ship a static Bearer token (it satisfies the `Authorization: Bearer` shape) and skip the RFC 9728/8414/7591 dance; this works with most clients today (Claude Desktop, Claude Code, Cursor accept a custom header / token at config time), but it isn't strictly conformant. For an internal Next.js server gated to your own users, a Bearer token tied to your existing NextAuth session JWT is pragmatic. For a public/marketplace MCP server, do full OAuth.

---

## 7. Stateless vs Stateful

Yes — a Streamable HTTP server can be fully stateless and still compliant. Required minimum:

- Single `/mcp` POST endpoint.
- Do not emit `Mcp-Session-Id` on the `InitializeResult` response. Then the spec says clients don't include the header on later requests, and they don't need to.
- Reply to every POST with `Content-Type: application/json` (one JSON-RPC response per request). No SSE needed.
- `GET /mcp` → return `405 Method Not Allowed`.
- `DELETE /mcp` → return `405 Method Not Allowed`.
- Still handle `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, and `ping`. (Re-run the init handshake mentally on every request — it's cheap if `initialize` is pure.)

This shape is what the SDK's `simpleStatelessStreamableHttp.ts` example does: each POST creates a fresh transport, processes the body, and discards state. Stateless mode is the natural fit for **serverless Next.js route handlers** (Vercel, Cloudflare Workers, Railway autoscale). The spec confirms `Mcp-Session-Id` is `MAY`, not `MUST` (see [session management](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#session-management)).

Trade-offs: no server→client requests/notifications outside a tool call (no progress streaming, no `tools/list_changed`, no sampling). For 95% of API-wrapping tool servers, fine.

---

## 8. Protocol Versions

`protocolVersion` is a date-stamp string. Known values:

| Version | Status | Transport notes |
|---|---|---|
| `2024-11-05` | Legacy; deprecated HTTP+SSE transport (separate POST + SSE endpoints) | First public release |
| `2025-03-26` | Streamable HTTP introduced; default assumed when no `MCP-Protocol-Version` header is present | Widely supported by current Claude clients |
| `2025-06-18` | **Current latest** at time of writing | Adds RFC 9728 protected-resource-metadata for auth; `resource_link` content type; structured tool output; `outputSchema`; `elicitation` client capability |

**Negotiation:** client sends its latest; server echoes if it supports it, else replies with a version *it* supports (preferably its own latest). Client disconnects if it can't handle the server's response. Over HTTP, the negotiated version then rides on every subsequent request as the `MCP-Protocol-Version` header. (Spec: [version negotiation](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#version-negotiation), [protocol version header](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#protocol-version-header).)

For a new server in 2026: advertise `2025-06-18` and accept `2025-03-26` for backwards compat.

---

## 9. Minimal Next.js App Router Implementation

Drop this at `src/app/api/mcp/route.ts`. Stateless, no SDK, one tool. Edge-runtime safe (no `pg`/Prisma at module scope). Replace the `echo` tool body with real logic.

```ts
// src/app/api/mcp/route.ts
import { NextRequest, NextResponse } from "next/server";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "artifacial-mcp", version: "0.1.0" };

const TOOLS = [
  {
    name: "echo",
    title: "Echo",
    description: "Returns whatever text you send.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo back" } },
      required: ["text"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

async function handle(msg: any) {
  // Notifications (no id) → ack via HTTP 202, no body
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize":
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args } = msg.params ?? {};
      if (name === "echo") {
        return rpcResult(msg.id, {
          content: [{ type: "text", text: String(args?.text ?? "") }],
          isError: false,
        });
      }
      return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: NextRequest) {
  // Optional: bearer auth
  // const auth = req.headers.get("authorization");
  // if (auth !== `Bearer ${process.env.MCP_TOKEN}`) {
  //   return new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  // }

  const body = await req.json();
  const msg = Array.isArray(body) ? body[0] : body; // batching not required in 2025-06-18
  const response = await handle(msg);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response, {
    headers: { "MCP-Protocol-Version": PROTOCOL_VERSION },
  });
}

export async function GET()    { return new NextResponse("Method Not Allowed", { status: 405 }); }
export async function DELETE() { return new NextResponse("Method Not Allowed", { status: 405 }); }
```

For a richer server (sessions, SSE streaming, progress notifications), use `@modelcontextprotocol/sdk` and its `StreamableHTTPServerTransport` — but you need a Node runtime (not Edge), and you must adapt `NextRequest` ↔ Node `IncomingMessage`. Pattern: instantiate `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` for stateless mode (the SDK explicitly supports this) per route invocation, call `await server.connect(transport)`, then `transport.handleRequest(req, res, parsedBody)`. For App Router you typically convert to a Web `Request`/`Response` pair via a small shim.

---

## 10. Claude Desktop / Claude Code Config Block

Claude Desktop config file location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**HTTP MCP server entry (Streamable HTTP, current schema):**

```json
{
  "mcpServers": {
    "artifacial": {
      "type": "http",
      "url": "https://artifacial.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

For **local dev** against `npm run dev`:

```json
{
  "mcpServers": {
    "artifacial-local": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer dev-token" }
    }
  }
}
```

**Claude Code** uses the same JSON shape, but you register via the CLI (which writes it to `~/.claude.json` or project-level `.mcp.json`):

```bash
claude mcp add --transport http artifacial https://artifacial.com/api/mcp \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

Equivalent `.mcp.json` (project-scoped, checkable into git):

```json
{
  "mcpServers": {
    "artifacial": {
      "type": "http",
      "url": "https://artifacial.com/api/mcp",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN}" }
    }
  }
}
```

Older Claude Desktop builds only supported `stdio` and required a local proxy (`npx mcp-remote https://your-server/mcp`) to bridge to HTTP servers — if a user is on an outdated client, fall back to:

```json
{
  "mcpServers": {
    "artifacial": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://artifacial.com/api/mcp",
               "--header", "Authorization:Bearer YOUR_TOKEN_HERE"]
    }
  }
}
```

After editing the config, fully quit and relaunch Claude Desktop. Verify the server appears under the tools/connector indicator and that `tools/list` returns your tool.

---

## Sources

- [MCP Specification 2025-06-18 (overview)](https://modelcontextprotocol.io/specification/2025-06-18)
- [Transports — Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [Lifecycle — initialize handshake and version negotiation](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [Server Tools — `tools/list`, `tools/call`, content blocks](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Authorization — OAuth 2.1 / RFC 9728 / RFC 8707](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Ping utility](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/ping)
- [Cancellation utility](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation)
- [TypeScript SDK repo (`StreamableHTTPServerTransport`)](https://github.com/modelcontextprotocol/typescript-sdk)
- [Stateless SDK example — `simpleStatelessStreamableHttp.ts`](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStatelessStreamableHttp.ts)
- [SDK PR #266 — server-side Streamable HTTP](https://github.com/modelcontextprotocol/typescript-sdk/pull/266)
- [SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)