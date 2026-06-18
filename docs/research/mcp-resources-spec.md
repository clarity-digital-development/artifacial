I have enough material. Skipping TodoWrite — this is a single research deliverable, no task tracking needed. Let me compile the final guide.

---

# MCP Resources Primitive — Technical Guide (Spec 2025-06-18)

Comprehensive reference for exposing a markdown "skill" or "guide" document via an MCP server's `resources` primitive, with concrete answers for Claude Desktop, Claude Code, and Cursor compatibility.

**Primary sources**
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources (canonical — all `resources/*` methods live on this single page; the `/list` and `/read` subpages return 404)
- https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle

---

## 1. Capability declaration

Servers that support resources **MUST** declare the `resources` capability in `InitializeResult.capabilities`. Both sub-fields are optional booleans:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "resources": {
        "subscribe": false,
        "listChanged": false
      }
    },
    "serverInfo": {
      "name": "artifacial-skill-server",
      "title": "Artifacial Skill Server",
      "version": "1.0.0"
    },
    "instructions": "Read the artifacial://skill/usage-guide resource before answering."
  }
}
```

- `subscribe` — whether the client can call `resources/subscribe` for per-URI change notifications.
- `listChanged` — whether the server will emit `notifications/resources/list_changed` when the catalog changes.

Spec quote: *"Both `subscribe` and `listChanged` are optional—servers can support neither, either, or both"* — so for a single static skill document, declare `{}` (both omitted/false) and skip subscription plumbing entirely.

Also note — the top-level `instructions` string in `InitializeResult` is your single best lever to nudge a client to actually read your resource on connect (Claude Code surfaces these to the model as a system note).

---

## 2. `resources/list`

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

`params` and `params.cursor` are both optional. Send no params (or `params: {}`) on the first page.

**Response — `Resource` object fields:**

| Field | Required | Type | Notes |
|---|---|---|---|
| `uri` | yes | string | Unique identifier (RFC 3986 URI). |
| `name` | yes | string | Programmatic name. |
| `title` | no | string | Human-readable display name. |
| `description` | no | string | Free text — the client surfaces this. |
| `mimeType` | no | string | e.g. `text/markdown`. |
| `size` | no | number | Size in bytes. |
| `annotations` | no | object | `{ audience, priority, lastModified }`. |

**Annotations** (optional, sit alongside the other fields):
- `audience`: `("user" | "assistant")[]` — who should consume it.
- `priority`: `0.0`–`1.0` — `1` is "effectively required", `0` is "entirely optional".
- `lastModified`: ISO-8601 timestamp.

**Spec example response (verbatim):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [
      {
        "uri": "file:///project/src/main.rs",
        "name": "main.rs",
        "title": "Rust Software Application Main File",
        "description": "Primary application entry point",
        "mimeType": "text/x-rust"
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

For a skill doc, the spec's annotated example is the better template:

```json
{
  "uri": "artifacial://skill/usage-guide",
  "name": "usage-guide",
  "title": "Artifacial Usage Guide",
  "description": "How to call Artifacial generation APIs. Read this first.",
  "mimeType": "text/markdown",
  "size": 8421,
  "annotations": {
    "audience": ["assistant"],
    "priority": 1.0,
    "lastModified": "2026-06-17T00:00:00Z"
  }
}
```

---

## 3. `resources/read`

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "artifacial://skill/usage-guide"
  }
}
```

**Response** — the `result.contents` array can hold one **or many** entries (a single URI may expand to multiple content blocks, e.g. a directory). Each entry is **either** a `TextContent` or a `BlobContent`:

**Text variant** (use this for markdown):
```json
{
  "uri": "file:///example.txt",
  "mimeType": "text/plain",
  "text": "Resource content"
}
```

**Binary variant:**
```json
{
  "uri": "file:///example.png",
  "mimeType": "image/png",
  "blob": "base64-encoded-data"
}
```

Spec quote: *"Binary data **MUST** be properly encoded"* — `blob` is base64.

Full response for a markdown skill:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "artifacial://skill/usage-guide",
        "mimeType": "text/markdown",
        "text": "# Artifacial Usage Guide\n\n..."
      }
    ]
  }
}
```

---

## 4. URI scheme

Per spec there are three "common" schemes — and a permissive escape hatch for custom ones:

| Scheme | When to use |
|---|---|
| `https://` | *"only when the client is able to fetch and load the resource directly from the web on its own—that is, it doesn't need to read the resource via the MCP server."* If the client should always route through your server, do **not** use `https://`. |
| `file://` | *"resources that behave like a filesystem. However, the resources do not need to map to an actual physical filesystem."* Acceptable for synthetic content, but implies filesystem semantics. |
| `git://` | Git VCS integration. |
| **Custom** | *"Custom URI schemes **MUST** be in accordance with RFC3986"* — fully blessed by the spec. |

Spec recommendation for your case: *"For other use cases, servers **SHOULD** prefer to use another URI scheme, or define a custom one, even if the server will itself be downloading resource contents over the internet."*

**Verdict for `artifacial://skill/usage-guide`:** yes — a custom scheme is explicitly endorsed by the spec, and is the **preferred** choice over `https://` when the client must round-trip through your server to read. Client compatibility: Claude Desktop, Claude Code, and Cursor all treat the URI as opaque — they don't dereference it themselves; they just call `resources/read` with that URI back to your server. So `artifacial://...` works identically to `file://...` from the client's perspective.

**Exact URI shape examples from the spec:**
- `file:///project/src/main.rs`
- `file:///example.txt`
- `file:///example.png`
- `file:///project/README.md`
- `file:///nonexistent.txt`

Note the *three* slashes — `file://` + empty authority + absolute `/path`. For a custom scheme like `artifacial://skill/usage-guide`, `skill` is the authority and `/usage-guide` is the path — both forms are RFC 3986-compliant.

---

## 5. `resources/templates/list`

**Not required** for a single static resource. Templates exist for *parameterized* resources using RFC 6570 URI templates — e.g. `file:///{path}` where `{path}` is filled in per-call, often with autocompletion via the `completion/complete` API.

For one fixed skill doc, list it directly in `resources/list` and skip `resources/templates/list` entirely. (Clients that probe `resources/templates/list` should gracefully accept an empty array `{ "resourceTemplates": [] }` or a method-not-found error.)

Implement templates only when:
- You want a single entry to cover many URIs (e.g. `artifacial://character/{characterId}`), or
- You want client-side autocomplete on the URI arguments.

---

## 6. Notifications

Two notifications exist; **neither is required** for a static skill resource:

- `notifications/resources/list_changed` — emit only if you declared `listChanged: true` and the catalog actually mutates at runtime. Spec: *"servers that declared the `listChanged` capability **SHOULD** send a notification"* when the list changes.
- `notifications/resources/updated` — emit only if you declared `subscribe: true`, the client has called `resources/subscribe` for that specific URI, and the content has changed.

For a hard-coded `artifacial://skill/usage-guide`, declare `{ "resources": {} }` and never emit either notification. Zero extra plumbing.

---

## 7. Client discovery UX

The spec is deliberately **non-prescriptive** on UX. Verbatim:

> "Resources in MCP are designed to be **application-driven**, with host applications determining how to incorporate context based on their needs.
>
> For example, applications could:
> - Expose resources through UI elements for explicit selection, in a tree or list view
> - Allow the user to search through and filter available resources
> - Implement automatic context inclusion, based on heuristics or the AI model's selection
>
> However, implementations are free to expose resources through any interface pattern that suits their needs—the protocol itself does not mandate any specific user interaction model."

What this means per client (as of mid-2026):

- **Claude Desktop** — resources are NOT auto-attached. Users must explicitly attach them via the paperclip / attach-from-MCP picker (the "resource context picker" UI shown in the spec screenshot). They appear as a flat list per server.
- **Claude Code** — resources can be referenced with `@server:protocol://path` syntax (e.g. `@artifacial:artifacial://skill/usage-guide`) in the prompt. They are not injected automatically into every turn. The CLI also exposes them under `/mcp` and tab completion.
- **Cursor** — similar to Claude Desktop: explicit selection from the MCP panel; no automatic injection.

**Implication for a skill doc:** because none of the major clients auto-load resources, your guide is only useful if (a) the user attaches it, (b) the model is prompted to fetch it, or (c) you expose the same content through other primitives. Three reliable nudges:

1. Put a directive in `InitializeResult.instructions` — Claude Code surfaces this to the model. Example: `"A usage guide is available at resource artifacial://skill/usage-guide — read it before invoking generation tools."`
2. Set `annotations.priority: 1.0` and `annotations.audience: ["assistant"]` so heuristic-driven clients prioritize it.
3. Also expose the guide as a `prompt` (via the `prompts` primitive, which IS surfaced as a slash-command in Claude Desktop) or embed a one-line pointer in every tool's `description` — both are more visible than a passive resource.

---

## 8. Cursor pagination

Yes — `resources/list` supports the same opaque-cursor pagination as `tools/list`, `prompts/list`, and `resources/templates/list`.

**Params:**
```json
{ "cursor": "eyJwYWdlIjogMn0=" }
```

**Response:**
```json
{
  "result": {
    "resources": [ /* ... */ ],
    "nextCursor": "eyJwYWdlIjogMn0="
  }
}
```

Rules (verbatim from the pagination spec):
- *"The cursor is an opaque string token, representing a position in the result set"*
- *"Page size is determined by the server, and clients MUST NOT assume a fixed page size"*
- Missing `nextCursor` ⇒ end of results.
- Clients **MUST** treat cursors as opaque: *"Don't make assumptions about cursor format / Don't attempt to parse or modify cursors / Don't persist cursors across sessions"*
- Invalid cursors → JSON-RPC error code `-32602` (Invalid params).

For a single skill resource you can simply omit `nextCursor` from the response.

---

## 9. Minimal compliant TypeScript server (~40 lines)

Using `@modelcontextprotocol/sdk` over stdio. Returns one markdown resource:

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";

const SKILL_URI = "artifacial://skill/usage-guide";
const SKILL_PATH = new URL("./usage-guide.md", import.meta.url);

const server = new Server(
  { name: "artifacial-skill-server", version: "1.0.0" },
  { capabilities: { resources: {} } } // no subscribe, no listChanged
);

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{
    uri: SKILL_URI,
    name: "usage-guide",
    title: "Artifacial Usage Guide",
    description: "How to call Artifacial generation APIs. Read this first.",
    mimeType: "text/markdown",
    annotations: { audience: ["assistant"], priority: 1.0 },
  }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri !== SKILL_URI) {
    throw { code: -32002, message: "Resource not found", data: { uri: req.params.uri } };
  }
  return {
    contents: [{
      uri: SKILL_URI,
      mimeType: "text/markdown",
      text: await readFile(SKILL_PATH, "utf8"),
    }],
  };
});

await server.connect(new StdioServerTransport());
```

That's a fully compliant 2025-06-18 server for one static markdown skill. No subscriptions, no templates, no notifications.

---

## 10. Best practices for a "skill" / "guide" resource

| Field | Recommendation | Why |
|---|---|---|
| `uri` | Custom scheme: `artifacial://skill/usage-guide` | Spec explicitly recommends custom schemes when the client routes reads through your server. Avoids `file://` filesystem-semantics confusion and avoids `https://` (which signals the client can fetch it directly). |
| `name` | `"usage-guide"` — kebab-case, programmatic, stable | Used as a stable identifier; never localized. |
| `title` | `"Artifacial Usage Guide"` — Title Case, human-readable | Shown in the Claude Desktop / Cursor attach picker. |
| `description` | `"Authoritative guide for calling Artifacial generation tools. Read this before invoking any generation tool — covers credit costs, prompt format, character workflow, and error handling."` | This is the only string the model sees when deciding to fetch. Be explicit, lead with action ("Read this before…"), name the tools it informs. |
| `mimeType` | `"text/markdown"` | Preferred over `text/plain` — both Claude Desktop and Claude Code render markdown in resource previews, and the model handles `text/markdown` content blocks natively. `text/plain` works but loses structure hints. |
| `size` | bytes (`Buffer.byteLength(md, "utf8")`) | Lets clients budget context and warn before attaching huge docs. |
| `annotations.audience` | `["assistant"]` | Signals "this is for the model, not a user-facing artifact." If users should also browse it, use `["user", "assistant"]`. |
| `annotations.priority` | `1.0` | Spec: *"A value of 1 means 'most important' (effectively required)"*. Heuristic-driven clients will rank it first. |
| `annotations.lastModified` | ISO-8601 of the doc's mtime | Lets clients sort by recency and the model reason about staleness. |

**Beyond the resource itself, the highest-leverage moves are:**

1. **Set `InitializeResult.instructions`** to a one-liner that names the resource URI. Claude Code surfaces this to the model on connection — much more reliable than waiting for the user to attach.
2. **Mirror the same content as an MCP `prompt`** (via the `prompts` primitive). Prompts appear as slash-commands in Claude Desktop and `/` completions in Claude Code — they're more discoverable than resources.
3. **Reference the resource URI from each tool's `description`** (e.g. *"See artifacial://skill/usage-guide for credit costs and prompt format."*) — the model reads tool descriptions on every turn.
4. **Keep the doc small** (< 8KB). Resources are loaded into the context window verbatim when attached; long guides crowd out the user's task.
5. **Use stable URIs** — never change `artifacial://skill/usage-guide` once shipped; clients may cache attachment state by URI.

---

### Source URLs

- Resources (canonical, includes /list, /read, /templates, /subscribe, notifications, URI schemes, errors): https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- Pagination: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
- Lifecycle / `InitializeResult` shape: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- Note: the standalone `/server/resources/list` and `/server/resources/read` URLs in your prompt return HTTP 404 — the 2025-06-18 spec consolidates all `resources/*` methods onto the single `/server/resources` page.