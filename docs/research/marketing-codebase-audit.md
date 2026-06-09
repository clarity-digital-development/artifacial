I have enough to write the audit. Let me return the findings.

---

# Marketing Studio v1 — Codebase Audit

## 1. Existing UGC Hook preset (`preset-ugc-hook`)

**Registry entry** — `src/lib/workshop/tools.ts:302-313`
- slug: `preset-ugc-hook`, name: `Cinematic UGC Hook`, category: `video`, credits: **2000**, creditLabel: `2,000 cr · 5s · 720p`, outputType: `video`, status: `available`.
- Description explicitly says "Built on Kling 3.0 with native multi-image support, 720p, 5 seconds."

**Workflow type mapping** — `src/lib/workshop/tools.ts:699`: any `preset-*` slug routes to `IMAGE_TO_VIDEO`.

**Form component** — `src/app/(app)/workshop/[tool]/tool-page-client.tsx:1668-1708` (`UgcHookPreset`)
- Two image inputs + one optional text input. Shape submitted to server:
  ```ts
  { characterImage, productImage, description: description.trim() }
  ```
- Uses `ImageInput` for the creator photo (selects from existing characters/library), `ImageUpload` for the product photo (fresh upload), and a `TextInput` for the optional "Hook description".
- Dispatch is wired at `tool-page-client.tsx:2223`: `case "preset-ugc-hook": return <UgcHookPreset {...props} />;`

**Server build-task** — `src/app/api/workshop/[tool]/route.ts:561-580`
- Resolves both images to URLs via `resolveImg(userId, ...)`.
- Throws if either image missing.
- Default description fallback: `"casually demonstrating the product with a genuine excited reveal"`.
- Prompt (literal): `` `@image_1 The creator from the first reference image holding and showing @image_2 (the product) — ${description}. Authentic UGC-style phone video: natural handheld phone camera with subtle shake, soft window lighting, casual home or office setting, genuine emotional reaction, phone-quality realism (NOT cinematic). Direct-to-camera framing typical of viral TikTok creator content.` ``
- Model call returned to the dispatcher:
  ```ts
  { model: "kling", taskType: "omni_video_generation",
    input: { prompt, images: [charImg, productImg], duration: 5,
             aspect_ratio: "9:16", resolution: "720p", version: "3.0" } }
  ```
- Credit cost set centrally at `route.ts:262`: `case "preset-ugc-hook": return 2000;` — the comment notes "Kling 3.0 omni 720p, $0.10/s × 5 = $0.50 → 2000 cr (75%)" margin.

## 2. Sidebar nav pattern

**File**: `src/components/sidebar.tsx`

- Icons are **inline JSX components** declared at the top of the file: `IconStudio` (lines 9-17), `IconCharacters` (19-26), `IconGenerate` (28-34, play-triangle), `IconWorkshop` (36-42, wrench), `IconGallery` (44-52), `IconSettings` (54-61). All 20×20 stroke="currentColor" Lucide-style SVGs.
- Two static arrays drive top-level routes:
  - `NAV_BEFORE_CREATE` (line 63): `[{ href: "/studio" }, { href: "/characters" }]`
  - `NAV_AFTER_CREATE` (line 68): `[{ href: "/gallery" }, { href: "/settings" }]`
- Between them is a `Create` dropdown button (lines 135-168) that fans out to `/generate` and `/workshop`.
- Active state uses `pathname.startsWith(item.href)` — line 116 and 172.
- Gating example: NSFW dot rendered next to Settings only when `isNsfw && item.href === "/settings"` (line 186-188). No subscription/tier gating in the sidebar itself.
- Active style: `bg-[var(--accent-amber-glow)] text-[var(--accent-amber)]` with a soft amber shadow (lines 124, 180).

**Mobile nav** — `src/components/mobile-nav.tsx` — duplicate static structure: `STATIC_NAV_ITEMS` (lines 8-45) with the same four routes inline. Create button portals a sheet identical to the desktop dropdown.

**Where /marketing fits**: There's no existing sub-nav slot. The clean placement is to **add it as a 3rd item in `NAV_BEFORE_CREATE`** (or as a new array after the Create dropdown) so it lives as a sibling of Studio/Characters/Gallery, *not* under the Create flyout. The Create flyout is reserved for primitive create surfaces (one-off generate / workshop tools), while Marketing Studio is a higher-level workspace. **You must update both** `src/components/sidebar.tsx` (desktop) **and** `src/components/mobile-nav.tsx` (mobile bottom bar — currently 4 items + center Create, so adding a 5th will require either swapping in /marketing for one of them or restyling).

## 3. Route-group structure

`src/app/(app)/layout.tsx` is the authenticated shell — auth-redirect (line 15), loads credits + content mode + tier (lines 22-38), then renders `<Sidebar>` + `<TopBar>` + `<main>` + `<MobileNav>`. The shell applies `grain` and `ambient-light` body classes (line 41).

Existing top-level siblings under `(app)`: `studio`, `characters`, `gallery`, `settings`, `workshop`, `generate`, `edit`, `agency`, `affiliate`, `admin` (see `src/app/(app)/*/page.tsx` glob).

**Recommendation for /marketing**: Make it a sibling of `/studio`, `/workshop`, `/gallery` — i.e., create `src/app/(app)/marketing/page.tsx` (and any sub-routes like `src/app/(app)/marketing/[campaignId]/page.tsx`). Do NOT nest it under `/workshop` — Workshop is a flat tool grid filtered by category, and Marketing Studio is a multi-step workspace, not a single tool.

## 4. Claude integration patterns

**Anthropic SDK usage in repo** — only one production callsite: `src/lib/analysis/virality.ts` (the only `new Anthropic()` in `src/`).

**`src/lib/anthropic.ts`** exists but is misleadingly named — it actually uses **Venice AI** (line 4: `import { getVeniceClient, VENICE_MODEL }`). It does NOT wrap Anthropic. So there's no shared Anthropic wrapper today; **you should build a small per-feature module mirroring `virality.ts`**, not extend `anthropic.ts`.

**Pattern from `virality.ts` to copy:**
- Module-scope `SYSTEM_PROMPT` constant (`virality.ts:36-62`) with a strict "return ONLY this JSON shape" instruction.
- `const client = new Anthropic();` — SDK reads `ANTHROPIC_API_KEY` from env (no helper, just default constructor at line 141).
- Pre-flight env check: `if (!process.env.ANTHROPIC_API_KEY) throw ...` (line 134).
- `client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2000, system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }], messages: [...] })` — system prompt passed as an array of blocks with `cache_control: { type: "ephemeral" }` (lines 142-171).
- Response parsing: find the text block (`response.content.find(c => c.type === "text")`), then regex-match the first `{...}` from the text (`text.match(/\{[\s\S]*\}/)`), JSON.parse, and defensively normalize each field (lines 173-202).
- Returns a clamped/normalized typed object.

**Verdict**: for Marketing Studio's Claude call, write a tiny `src/lib/marketing/copy.ts` (or similar) that mirrors `virality.ts` line-for-line — module-level system prompt with `cache_control` ephemeral, `new Anthropic()`, `claude-sonnet-4-6`, JSON-only return contract, regex+JSON.parse extraction, defensive normalization. No new wrapper needed; the SDK default constructor + env var is the pattern.

## 5. Image upload helpers

**`resolveImg(userId, v)`** — `src/app/api/workshop/[tool]/route.ts:97-102` (file-local, not exported):
```ts
async function resolveImg(userId: string, v: unknown): Promise<string | undefined> {
  if (!v) return undefined;
  if (isBase64(v)) return uploadBase64ToR2(userId, v);   // line 99
  if (typeof v === "string") return v;                    // pass through URL
  return undefined;
}
```
- `isBase64` (line 92): checks `v.startsWith("data:")`.
- `uploadBase64ToR2` (lines 81-90) parses `data:mime;base64,xxx`, extracts mime + ext, writes to R2 at `users/${userId}/workshop/${randomUUID()}.${ext}` via `uploadToR2`, then returns a 2-hour signed URL via `getSignedR2Url(key, 7200)`.
- **It is currently file-local — not exported.** To reuse from a non-workshop route (Marketing Studio API), either (a) export `resolveImg`, `resolveImgArray`, `uploadBase64ToR2` from `src/app/api/workshop/[tool]/route.ts` (awkward — route files don't typically export helpers), or (b) extract into a new shared module like `src/lib/uploads/resolve-image.ts` and import from both places. Option (b) is cleaner. Note: the R2 path includes `/workshop/` — you'll want to parameterize that to `/marketing/` (or similar) when extracting.

**`safeFetchUserUrl`** — defined in `src/lib/security/safe-fetch.ts:137-206`, **exported**.
- Hardened against SSRF (full doc-comment lines 1-24): pre-flight DNS lookup, blocks private IPv4/IPv6 ranges including 169.254.169.254 metadata, manual redirect handling re-validating each Location header, 50 MB cap, 3 redirect max, 30 s timeout.
- Returns a `Buffer`.
- Already imported in `route.ts:21` and used by Virality Predictor. **Safe to use from anywhere** the user passes a URL — exactly the case for fetching a product image by URL in Marketing Studio. Companion `assertPublicUrl` (line 75) is also exported if you only need to validate without fetching.

## 6. Project / Generation persistence

**`Project` model** — `prisma/schema.prisma:224-245`:
```prisma
model Project {
  id, userId, user, name (default "Untitled Project"),
  mode (default "text2video"), characterId, character?, prompt?,
  enhancedPrompt?, sourceVideoUrl?, sourceImageUrl?, duration? (default "5"),
  aspectRatio? (default "16:9"), status (default "draft"),
  finalVideoUrl?, createdAt, updatedAt,
  scenes Scene[], generations Generation[]
}
```
It is **legacy** — originally for the multi-scene "scene builder" flow. `Generation` already carries `projectId?` (`schema.prisma:276`), so you could in theory write a Project row per campaign. **But** the existing Workshop pattern does NOT write to Project — every workshop tool just writes a Generation row (see `createWorkshopGeneration` at `route.ts:37-77`).

**Verdict for v1**: follow the Workshop pattern — **just create Generation rows.** Mirror `createWorkshopGeneration` (`route.ts:37-77`):
- `workflowType`: closest enum value is `IMAGE_TO_VIDEO` (already what all `preset-*` slugs use — see `tools.ts:699`). Alternatives in `enum WorkflowType` (`schema.prisma:70-84`): `FACE_SWAP, IMAGE_TO_VIDEO, TEXT_TO_VIDEO, TEXT_TO_IMAGE, MOTION_TRANSFER, TALKING_HEAD, LIP_SYNC, UPSCALE, STYLE_TRANSFER, BACKGROUND_REMOVAL, VIRTUAL_TRY_ON, AI_HUG, IMAGE_EDIT`. There is **no `MARKETING_AD` enum value** — for v1 use `IMAGE_TO_VIDEO` if the output is video (or `TEXT_TO_IMAGE` if it's a still ad). If you want to identify Marketing-Studio generations later, stash a discriminator in `inputParams` (e.g. `{ surface: "marketing-studio", campaignName: "...", ... }`) — `inputParams` is `Prisma.InputJsonValue`, free-form (see `route.ts:62-69`). You can also use `modelId: "marketing-studio"` (or the underlying model slug) as a secondary marker.
- If a campaign has multiple outputs (e.g. 3 hook variants), write **multiple Generation rows** with a shared `batchId` in inputParams — same pattern Photodump/Headshot Generator uses (see `submitBatchImageScenes` at `route.ts:111-` and the explanatory comment).

## 7. SVG icon pool

All sidebar/mobile-nav icons are **inline JSX functions in the same file** — there is no shared icon module or icon library import.

- Desktop icons: `src/components/sidebar.tsx:9-61` — `IconStudio`, `IconCharacters`, `IconGenerate`, `IconWorkshop`, `IconGallery`, `IconSettings`.
- Mobile duplicates: `src/components/mobile-nav.tsx:8-57` — same five icons re-declared inline.
- All are stroke-only 20×20 Lucide-style SVGs (`fill="none" stroke="currentColor" strokeWidth="2"`).
- **No existing megaphone / marketing / ad / bullhorn icon** in the codebase (`Grep` for `marketing|MarketingStudio` in `src/` returned no files).

**Recommendation**: add a new `IconMarketing` (megaphone is the obvious choice — Lucide's `megaphone` path) inline in `src/components/sidebar.tsx` matching the existing style: `width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`. Mirror the same icon inline in `src/components/mobile-nav.tsx`.

---

### Key file paths summary
- `c:\Users\tanne\artifacial\src\lib\workshop\tools.ts` — preset registry + `getWorkflowTypeForTool`
- `c:\Users\tanne\artifacial\src\app\(app)\workshop\[tool]\tool-page-client.tsx` — `UgcHookPreset` at line 1668, dispatch at line 2223
- `c:\Users\tanne\artifacial\src\app\api\workshop\[tool]\route.ts` — `resolveImg` (97), `uploadBase64ToR2` (81), `createWorkshopGeneration` (37), `submitBatchImageScenes` (118), preset-ugc-hook case (561), credit costs (262)
- `c:\Users\tanne\artifacial\src\components\sidebar.tsx` — desktop nav + inline icons
- `c:\Users\tanne\artifacial\src\components\mobile-nav.tsx` — mobile bottom nav
- `c:\Users\tanne\artifacial\src\app\(app)\layout.tsx` — auth-guarded shell
- `c:\Users\tanne\artifacial\src\lib\analysis\virality.ts` — the only Anthropic SDK callsite to mirror
- `c:\Users\tanne\artifacial\src\lib\anthropic.ts` — misleadingly named, actually Venice; do NOT extend it
- `c:\Users\tanne\artifacial\src\lib\security\safe-fetch.ts` — `safeFetchUserUrl` + `assertPublicUrl`, both exported
- `c:\Users\tanne\artifacial\prisma\schema.prisma` — `Project` (224), `Generation` (272), `WorkflowType` enum (70)