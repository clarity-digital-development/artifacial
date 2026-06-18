Good — ~69 tools, matches "60+" framing. Drafting the skill now.

# Artifacial MCP — Usage Guide

> AI character + viral short-form video platform, exposed to your agent via 8 MCP tools.

## What Artifacial is

Artifacial is a consumer AI platform for creating persistent characters (from selfies or text) and starring them in short-form viral videos. The web app at `https://artifacial.app` exposes 60+ workshop tools spanning viral video presets, face/identity work (swap, lip sync, reenactment), image utilities (upscale, background, restyle), audio (TTS, music), and a Marketing Studio that turns a product URL into a finished ad. This MCP server exposes a small, useful subset of those capabilities for agent use — primarily inspection (credits, catalog, history) plus a handful of safe, high-leverage utilities (background removal, image upscale, virality scoring). Heavyweight video generation, character creation, and the Marketing Studio still live in the web UI.

## Tools available through this MCP

There are **8 tools**, split into free read-only utilities, one synchronous paid tool, and three async paid jobs.

### `get_credits` — free
Returns the authenticated user's balance broken into `subscription`, `purchased`, and `total`. **Call this first** before any paid action so you can confirm the user can afford it and warn proactively. No arguments.

### `list_workshop_tools` — free
Returns the full Artifacial workshop catalog (slug, name, category, credit cost, tagline, output type). Optional `category` filter: `"video" | "image" | "face" | "audio"`. Use this when the user asks "what can I do here" or "is there a tool for X". Remember: most catalog entries are NOT directly callable from MCP — they live in the web Workshop. Use this tool to discover-and-redirect, not to invoke.

### `list_recent_generations` — free
Returns up to the last 50 generations (default 20) for this user, across both web and MCP submissions. Supports `status: "PROCESSING" | "COMPLETED" | "FAILED"`. Each row includes `id`, `modelId`, `workflowType`, `credits`, signed `outputUrl`, `thumbnailUrl`, and timestamps. Use this when the user says "show me what I've made", "did my last render finish", or to find an asset to upscale.

### `get_generation` — free
Poll one generation by `generationId`. **Required** after every async tool call (`remove_image_background`, `upscale_image_recraft`, `upscale_image_topaz`) to retrieve the final `outputUrl`. Returns `status`, `progress` (0–100), `outputUrl` when complete, or sanitized `errorMessage` on failure.

### `analyze_video_virality` — 200 cr, **synchronous**
Scores a short-form video using Claude Sonnet 4.6 across hook / retention / scroll-stop / overall, with verdict text and concrete recommendations. Input: `videoUrl` (public MP4 URL, 5–30 s recommended, ≤100 MB). Returns the full score inline — no polling needed. Credits are auto-refunded on failure (e.g. unreachable URL).

```json
{ "videoUrl": "https://example.com/my-clip.mp4" }
```

### `remove_image_background` — 10 cr, async
Submits to PiAPI image-toolkit. Returns `{ generationId, status: "processing" }`. Poll with `get_generation`. Typical completion: 5–20 s.

```json
{ "imageUrl": "https://example.com/photo.jpg" }
```

### `upscale_image_recraft` — 60 cr, async (budget)
Recraft Crisp Upscale. Good default for general cleanup of a Gemini/SD output. Returns `generationId`. Typical completion: 20–60 s.

### `upscale_image_topaz` — 800 / 1,600 / 3,200 cr, async (premium)
Topaz Photo AI at `upscaleFactor: 2 | 4 | 8`. Higher quality (restored detail, crisp edges) than Recraft. Use for final hero assets, print, or large displays. Typical completion: 1–4 min.

```json
{ "imageUrl": "https://...", "upscaleFactor": 4 }
```

## Workflow patterns

**"How many credits do I have?"**
Call `get_credits`. Report `total` and note the subscription/purchased split.

**"What tools does Artifacial have?"**
Call `list_workshop_tools` (optionally filter by category). Group results by category in your reply. If a tool the user wants isn't in this MCP, send them to `https://artifacial.app/workshop` (see the redirect map below).

**"Did my video finish?" / "Show me what I made today."**
Call `list_recent_generations` (default 20). Filter client-side by `queuedAt` if needed. Surface `outputUrl` for COMPLETED items and `errorMessage` for FAILED ones.

**"Upscale this image."** (typical async flow)
1. `get_credits` — confirm ≥ cost for the chosen tier.
2. `upscale_image_topaz` (or `_recraft`) with the image URL.
3. Capture the returned `generationId`.
4. Poll `get_generation` every 5–10 s until `status === "COMPLETED"` or `"FAILED"`.
5. Return the signed `outputUrl` to the user.

**"Score this TikTok / Reel for me."**
Call `analyze_video_virality` directly with the video URL. Result is inline — present `overallScore`, the `verdict`, and the `recommendations` array. No polling.

**"Clean up the background on this product shot, then upscale it."**
Chain: `remove_image_background` → poll `get_generation` → take its `outputUrl` → feed to `upscale_image_topaz` → poll again.

## What this MCP does NOT expose

Send the user to the web app for any of the following:

| User asks for | Send them to |
|---|---|
| Create a new AI character (selfie or text) | `https://artifacial.app/characters/new` |
| Browse pre-built starter characters | `https://artifacial.app/community/characters` (12 founding + community marketplace) |
| Run a viral video preset (talking head, dance, reenactment, etc.) | `https://artifacial.app/workshop` |
| Marketing ad from a product URL (UGC / TV Spot / Hyper Motion, A/B/C variants) | `https://artifacial.app/workshop/marketing-studio` |
| NSFW presets / adult content | `https://artifacial.app/settings` to enable Content Mode (requires Starter+ subscription) |
| Audio: TTS, voice cloning, BGM | `https://artifacial.app/workshop?category=audio` |
| Face swap, lip sync, motion transfer | `https://artifacial.app/workshop?category=face` |
| View / download finished renders | `https://artifacial.app/gallery` |
| Manage plan, billing, top-ups | `https://artifacial.app/settings/billing` |

Do not attempt to invoke workshop tools through MCP that aren't in the 8-tool list above — there's no submission endpoint for them. Use `list_workshop_tools` to confirm a tool exists, then redirect.

## Credits + plans

1 credit ≈ $0.00025 of underlying API spend (75% margin baseline). Plans:

| Plan | $/mo | Credits/mo |
|---|---|---|
| Starter | $15 | 15,000 |
| Creator | $50 | 60,000 |
| Pro | $100 | 125,000 |
| Studio | $165 | 300,000 |

Top-up packs available for active subscribers. Subscription credits reset monthly; purchased credits roll over. Credits are deducted at job submission and **auto-refunded** to the purchased pool if the upstream provider fails. Check live cost with `list_workshop_tools` — the credit number in the catalog is authoritative.

## Best practices

- **Always `get_credits` before a paid tool.** Surface the cost and remaining balance so the user can confirm.
- **Polling cadence:** start at 3–5 s for background removal, 5–10 s for upscales, 10–15 s for Topaz 4x/8x. Never poll faster than every 3 s — you'll get rate-limited and waste tokens. Cap total polling at ~5 min; if still PROCESSING, tell the user to check `https://artifacial.app/gallery` and stop.
- **`imageUrl` / `videoUrl` must be publicly reachable.** Private R2 keys, `localhost`, `file://`, and signed URLs that expire mid-job will fail with `unreachable URL`. Credits auto-refund in that case.
- **Don't try to chain via raw URLs blindly** — always extract `outputUrl` from `get_generation` (it's a signed R2 URL valid for 1 hour) before feeding into the next tool.
- **Insufficient credits returns `isError: true`** with the required amount. Tell the user the gap and link `https://artifacial.app/settings/billing`.
- **Errors are sanitized** for the client; don't expect raw provider stack traces.
- **If the user wants something complex** (full preset, character creation, audio, NSFW, Marketing Studio), don't try to fake it through MCP utilities — send them to the right web URL. The web UI is far better for those flows and has UI affordances (uploaders, character pickers, preset previews) the agent can't replicate.

## Where to find more

- **MCP install / connect guide:** `https://artifacial.app/docs/mcp`
- **Full workshop catalog (browse / launch):** `https://artifacial.app/workshop`
- **Marketing Studio:** `https://artifacial.app/workshop/marketing-studio`
- **Community character marketplace:** `https://artifacial.app/community/characters`
- **Pricing & plan details:** `https://artifacial.app/pricing`
- **User's gallery (all renders):** `https://artifacial.app/gallery`