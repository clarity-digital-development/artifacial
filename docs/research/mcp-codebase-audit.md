I have all the data needed. Let me produce the final audit report.

# Artifacial Codebase Audit — MCP Server Implementation Reference

## 1. Prisma model + migration workflow

### User model (`prisma/schema.prisma:140-180`)
Current fields on `User`:
- Identity: `id` (cuid), `name`, `email` (unique), `emailVerified`, `image`, `hashedPassword`, `isAdmin`, `createdAt`, `updatedAt`
- Credits/subscription: `subscriptionTier` (enum SubscriptionTier — FREE/STARTER/CREATOR/PRO/STUDIO), `subscriptionCredits` (default 1000), `purchasedCredits` (default 0), `stripeCustomerId` (unique), `stripeSubscriptionId`, `isFoundingMember`, `foundingMemberPriceId`, `foundingMemberPlan`
- Moderation: `contentMode` (SFW/NSFW), `dateOfBirth`, `strikeCount`, `bannedAt`, `banReason`, `deletedAt`
- Affiliate: `referredByAffiliateId`
- Relations: `accounts`, `sessions`, `characters`, `projects`, `generations`, `creditTransactions`, `moderationEvents`, `affiliate`

### Prisma 7 setup (`prisma.config.ts:1-16`)
- `datasource db { provider = "postgresql" }` — no `url` in the schema; URL lives in `prisma.config.ts` via `process.env.DATABASE_URL`.
- Generator output: `../src/generated/prisma` → import `PrismaClient` from `@/generated/prisma/client`; types from `@/generated/prisma/client` (see `route.ts:16` — `import type { Prisma } from "@/generated/prisma/client";`).
- Client construction (`src/lib/db.ts:9-13`): builds a `pg.Pool` → wraps with `PrismaPg` adapter → passes `{ adapter }` to `new PrismaClient(...)`. Singleton-cached on `globalThis.prisma`.

### Migrations
- **No `prisma/migrations/` directory exists** at `c:/Users/tanne/artifacial/prisma/`. The only file is `schema.prisma`. The project apparently relies on `prisma db push` workflows (or migrations live elsewhere / are reset).
- Path is configured at `prisma.config.ts:11` (`migrations: { path: "prisma/migrations" }`), so the standard command would be `npx prisma migrate dev --name <name>` once migrations are initialized. For now you may need `npx prisma db push` for schema changes, followed by `npx prisma generate`.

### Existing session/credential patterns
- NextAuth `Session` model exists (`schema.prisma:114-120`) with `sessionToken @unique`, `userId`, `expires`. **Important**: auth uses JWT strategy (`auth.config.ts:6`), so the `Session` table exists for the adapter but isn't actively used for active sessions.
- `Account` (OAuth provider tokens — `schema.prisma:96-112`), `VerificationToken`, `PasswordResetToken` also present.
- **There is no existing API-key / personal-access-token model.** That's net-new for MCP.

---

## 2. Auth helpers

### Wiring
- `src/lib/auth.config.ts` — Edge-safe (`trustHost`, JWT strategy, Google provider, `authorized` callback that gates `/studio`, `/characters`, `/projects`, `/gallery`, `/settings`, `/generate` while letting `/workshop` through unauthenticated for preview).
- `src/lib/auth.ts` — Full config: spreads `authConfig`, adds `PrismaAdapter(prisma)`, layers `Credentials` provider (bcrypt vs `user.hashedPassword`). Exports `{ handlers, auth, signIn, signOut }`.
- The `events.signIn` callback (`auth.ts:34-49`) syncs `isAdmin` for emails in `ADMIN_EMAILS` and bumps them to `subscriptionTier: "PRO"` + `isFoundingMember: true`.
- JWT/session callbacks (`auth.ts:53-60`) put `user.id` on `token.sub` and copy to `session.user.id`.

### API-route auth pattern (universal)
Every API route uses:
```ts
import { auth } from "@/lib/auth";
const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```
Examples: `src/app/api/workshop/[tool]/route.ts:980-984`, `src/app/api/generate/route.ts:9-12`, `src/app/api/settings/profile/route.ts:6-9`, `src/app/api/usage/route.ts:32-34`.

### Rate-limiting / system principal helpers
- **No rate-limiting middleware exists.** Grep for `rateLimit` only hits `src/lib/errors.ts` (error-message string handling) and `src/app/api/generate/[id]/status/route.ts:523-571` (a PiAPI upstream-retry-on-rate-limit handler — not a request-rate-limiter for our API). The "rate-limit" mentioned in the workshop status route is for the upstream provider error code (10001), not for capping per-user request volume.
- **No "system principal" helper.** All routes assume a real `session.user.id`. For MCP, you'll likely want to add an auth shim that resolves an `(apiKey) → userId` and returns the same `{ user: { id } }` shape so downstream helpers don't care whether the caller is a session or an API key.

---

## 3. Settings page conventions

### Directory (`src/app/(app)/settings/`)
- `page.tsx` — server component
- `settings-client.tsx` — exports `ProfileSection` + `DangerZoneSection`
- `billing-client.tsx` — `BillingClient` (plans + credit packs + transaction history)
- `content-mode-client.tsx` — SFW/NSFW toggle with DOB modal + paywall modal

### Section pattern
Every settings section is a self-contained card (`settings-client.tsx:45-92` shows the canonical `ProfileSection`):
```tsx
<div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
  <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
    Section Name
  </h2>
  {/* form body with inline Save button using accent amber */}
</div>
```
Dangerous variants use red border (`border-red-500/20`) and a `Danger Zone` heading in `text-red-400` (`settings-client.tsx:125`).

### Form-mutation API pattern
**API routes (not server actions).** Every section issues a `fetch(...)` from the client and the handler lives at `src/app/api/settings/<feature>/route.ts`:
- `PATCH /api/settings/profile` (`profile/route.ts:5-28`) — name update
- `PATCH /api/settings/content-mode` (`content-mode/route.ts:5-91`) — SFW/NSFW + DOB
- `DELETE /api/settings/account` — account deletion
- Each route calls `auth()`, validates input, calls `prisma.user.update(...)`, returns JSON. No server actions are used here.

### Reusable components
- No `<SettingsCard>` wrapper — the `<div className="rounded-... border bg-[var(--bg-surface)] p-6">` pattern is hand-rolled per section. (Worth creating a `SettingsCard` if you're adding 1+ new sections for MCP.)
- Reusable atoms exist in `src/components/ui/` (Badge, ProgressBar are imported by `BillingClient`).
- The settings page is a 2-column grid (`grid lg:grid-cols-2` — `page.tsx:56`) — left = profile/preferences, right = billing.

### Recommended location for an MCP-keys section
Add a new section file `src/app/(app)/settings/mcp-keys-client.tsx`, render it from `page.tsx` in the left column under `ContentModeClient`, and back it with a new API route `src/app/api/settings/mcp-keys/route.ts` (GET/POST/DELETE).

---

## 4. Workshop POST core flow

### Steps in `src/app/api/workshop/[tool]/route.ts` POST handler (lines 976-1239)
1. **Auth** — `auth()` → 401 if no `session.user.id` (`:980-984`)
2. **Resolve tool from slug** — `getToolBySlug(slug)` → 404 if unknown (`:987-990`)
3. **Parse body JSON** — 400 on parse error (`:993-997`)
4. **`computeCredits(slug, body)`** — pure function mapping slug → credit cost (`:217-293`, called at `:999`)
5. **`deductCredits(userId, credits, "Workshop: ${tool.name}")`** — 402 if insufficient (`:1002-1005`)
6. **Branch dispatch by slug family**:
   - `character-swap` — Nano Banana 2 via PiAPI (`:1007-1052`)
   - `virality-predictor` — synchronous Claude analysis, completes inline (`:1054-1131`)
   - `photodump` / `headshot-generator` — `submitBatchImageScenes(...)` multi-image batch (`:1133-1155`)
   - KIE.AI tools (`character-swap-remix`, `recraft-crisp-upscale`, `grok-video-upscale`, `topaz-image-upscale`) — KIE submission helpers + `kieai:image:` / `kieai:video:` taskId prefix (`:1157-1220`)
   - Default — `buildTask(slug, body, userId)` → `submitTask(model, taskType, input)` (PiAPI) (`:1222-1238`)
7. **`createWorkshopGeneration(...)`** — single helper (`:37-77`) that writes a `Generation` row with `workflowType` from `getWorkflowTypeForTool(slug)`, `status: "PROCESSING"`, `provider: "PIAPI"`, `modelId: slug`, `creditsCost: credits`, `inputParams` carrying `{ toolSlug, toolName, outputType, piApiTaskId | kieAiTaskId, submissionPath, ...stripHeavyKeys(body) }`.
8. **Return** `{ taskId, generationId, credits }` (numeric credits, not balance).

### Refactor for MCP — `runWorkshopTool(userId, slug, body)`
The route is highly extractable. To make a shared lib helper:

**Easily movable into `src/lib/workshop/run.ts`:**
- `stripHeavyKeys` (`:27-35`)
- `createWorkshopGeneration` (`:37-77`)
- `uploadBase64ToR2`, `isBase64`, `resolveImg`, `resolveImgArray` (`:81-109`)
- `submitBatchImageScenes` (`:118-213`) — needs to return a plain object instead of `NextResponse`
- `computeCredits` (`:217-293`)
- `buildTask` (`:297-972`)
- The dispatch chain inside POST (steps 5-7)

**Must stay HTTP-specific (or be parameterized):**
- The `auth()` call (replace with `userId` arg)
- `NextResponse.json(...)` returns (replace with thrown errors / plain return objects)
- `request.json()` body parse (replace with `body` arg)
- The `callbackUrl` construction for KIE.AI (`:1160`) uses `process.env.APP_URL` — fine to keep in shared lib

**Suggested signature**:
```ts
export type WorkshopRunResult =
  | { ok: true; taskId: string; generationId: string; credits: number; sync?: false }
  | { ok: true; sync: true; generationId: string; credits: number; result: unknown }
  | { ok: true; batchId: string; items: Array<...>; failedCount: number; creditsCharged: number }
  | { ok: false; status: number; error: string; errorCode?: string };

export async function runWorkshopTool(
  userId: string,
  slug: string,
  body: Record<string, unknown>,
): Promise<WorkshopRunResult>;
```
Then both the HTTP route and the MCP tool handler become thin wrappers.

### MCP-friendly tool candidates (single-input, simple async or sync)
**Good v1 candidates** (single image URL or short text, simple output):
- `joycaption` — image URL → text caption (40 cr, synchronous-ish via polling)
- `remove-bg` — image URL → image (10 cr)
- `super-resolution` — image URL → image (50 cr)
- `recraft-crisp-upscale` — image URL → image (60 cr)
- `topaz-image-upscale` — image URL + factor → image (800-3200 cr)
- `virality-predictor` — video URL → JSON score, **synchronous** (200 cr) — best candidate; already inline-returns the result without polling (`:1054-1131`)
- `music-gen` — text prompt → audio (200 cr)
- `diffrhythm` — lyrics + style prompt → audio (80 cr)
- `trellis3d` — image URL → 3D GLB (400 cr)

**Good v2 candidates** (single image input, longer async):
- `ai-hug` — single image → video
- All `preset-*` (single character image → video) — but most need a text customization slot too
- `outfit-swap` — needs 2 images, still simple
- `preset-magazine-cover` — single image → image

**Too complex for v1 (multi-image or rich uploads):**
- `photo-face-swap`, `multi-face-swap`, `video-face-swap`, `virtual-try-on` (2+ images, batch options)
- `preset-ugc-hook`, `preset-drift-racing`, `preset-ai-kiss/wedding/reunion` (2 reference images)
- `photodump`, `headshot-generator` (12/6-image batches)
- `talking-avatar` (image + audio URL)
- `lipsync`, `effects`, `kling-sound`, `video-remove-bg`, `watermark-remover`, `add-audio`, `song-extend` (video inputs or chained taskIds)
- `character-swap`, `character-swap-remix` (2 images)

The `virality-predictor` is unique because it returns the result synchronously in the POST response — perfect first MCP tool since you don't need to wire polling.

---

## 5. Credit balance read pattern

### Helper exists (`src/lib/credits.ts:6-25`)
```ts
export async function getAvailableCredits(userId: string): Promise<{
  subscription: number;
  purchased: number;
  total: number;
  isAdmin: boolean;
}>
```
- Single `prisma.user.findUnique` selecting `{ subscriptionCredits, purchasedCredits, isAdmin }`.
- Admins get `{ 999999, 999999, 999999, true }`.
- Use this directly for the MCP "get balance" tool.

### Other helpers in the same file
- `deductCredits(userId, amount, description, type="debit", generationId?)` (`:35-90`) — transactional, subscription-first, throws `INSUFFICIENT_CREDITS` internally, returns boolean. Admin path skips deduction.
- `refundCredits(userId, amount, description)` (`:96-114`) — always increments `purchasedCredits` (never subscription), creates `CreditTransaction` row of type `"refund"`.

### Existing inline balance reads (when you don't want the helper)
- `src/app/api/usage/route.ts:37-40` and `src/app/(app)/settings/page.tsx:15-27` — both inline `prisma.user.findUnique({ select: { subscriptionTier, subscriptionCredits, purchasedCredits, ... } })`. Either is fine.

---

## 6. Existing API key / token conventions

### No existing customer-facing API key/token model
Grep results for `apiKey|accessToken|secret_key` only hit:
- **Outbound provider clients** (third-party SDK calls): `src/lib/kieai.ts`, `src/lib/piapi-client.ts`, `src/lib/venice.ts`, `src/lib/gemini.ts`, `src/lib/anthropic.ts` (via `ANTHROPIC_API_KEY`), `src/lib/paypal.ts`, `src/lib/resend.ts`, `src/lib/stripe.ts`, `src/lib/analysis/virality.ts`, `src/lib/moderation/prompt-classifier.ts`, `src/app/api/workshop/upload-media/route.ts`
- **Generated Prisma types** (`Account.access_token` OAuth column)

There is no `ApiKey` model, no `/api/keys/*` route, no UI for issuing personal access tokens. The MCP-key concept is entirely net-new.

### Naming convention observed
- **Stripe**: `sk_live_...`, `price_...`, `whsec_...` (`.env.local:11-27`)
- **Anthropic**: `sk-ant-api03-...` (`.env.local:48`)
- **fal.ai**: `<uuid>:<hex>` (`.env.local:56`)
- **Sentry auth token**: `sntrys_...` (`.env.local:62`)
- **PostHog public key**: `phc_...` (`.env.local:65`)

**Suggested MCP key prefix**: follow the Stripe-style restricted-key convention. Use `afk_live_` (Artifacial Key) for production, `afk_test_` for test mode, with the body being ~32 bytes of `crypto.randomBytes(32).toString("base64url")`. Store only `sha256(rawKey)` in the DB. The error/sanitization helper at `src/lib/errors.ts` already exists for client-facing error scrubbing.

---

## 7. Recent Generations list pattern

### `GET /api/generate` (`src/app/api/generate/route.ts:142-173`)
```ts
const generations = await prisma.generation.findMany({
  where: { userId: session.user.id },
  orderBy: { queuedAt: "desc" },
  take: 50,
  select: {
    id, workflowType, status, provider, modelId, contentMode,
    resolution, durationSec, creditsCost,
    outputUrl, thumbnailUrl, errorMessage, progress,
    queuedAt, startedAt, completedAt,
  },
});
return NextResponse.json({ generations });
```
No filter on `workflowType` — workshop entries appear alongside `/generate` entries (as expected since `getWorkflowTypeForTool` maps every workshop slug to a sensible `WorkflowType`).

### Per-generation status (`src/app/api/generate/[id]/status/route.ts`)
Polled by the frontend; signs R2 keys with `getSignedR2Url(key, 3600)` before returning `outputUrl`. Also handles provider-specific polling (Venice, KIE.AI, PiAPI), refunds on failure, persists output to R2. Most MCP tools should just call this status route via the existing flow rather than re-implementing polling.

### Workshop poll (`src/app/api/workshop/poll/route.ts`)
A separate poll endpoint exists specifically for workshop submissions — check this file when you need the exact polling/result shape an MCP client should consume.

---

## 8. Env-var conventions

### Convention from `.env.local`
- **UPPER_SNAKE_CASE** universally.
- **Public-to-browser** variables prefixed `NEXT_PUBLIC_` (e.g. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`).
- **Provider keys** named `<PROVIDER>_<PURPOSE>_KEY` or `<PROVIDER>_API_KEY`: `GOOGLE_AI_API_KEY`, `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `KIE_AI_API_KEY`, `FAL_KEY`, `ANTHROPIC_API_KEY`, `THUNDER_COMPUTE_API_KEY`.
- **R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- **Stripe**: `STRIPE_<PURPOSE>` for secrets, `STRIPE_<PLAN>_PRICE_ID` for price refs.
- **Auth**: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`.
- **Database/queue**: `DATABASE_URL`, `REDIS_URL`.

### `APP_URL` for MCP
Grepping `APP_URL` confirms it's already in use across the codebase:
- `src/app/api/workshop/[tool]/route.ts:1160` — `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`
- `src/lib/generation/router.ts`, `src/app/api/edit/route.ts`, `src/app/api/agency/invite/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/(app)/affiliate/page.tsx`

`APP_URL` is **not currently set** in `.env.local` (relying on the fallback). For MCP server URLs (callbacks, well-known endpoints), set `APP_URL=https://artifacial.app` in `.env.local` going forward.

### New vars to add for MCP
Minimum recommended additions (none strictly required — you can derive everything from the DB once the schema exists):
- `APP_URL=https://artifacial.app` (set it explicitly rather than relying on the fallback)
- Optional: `MCP_KEY_PREFIX=afk_live_` if you want it env-configurable for test mode swaps

---

## Key file references for implementation

- Prisma client + adapter: `src/lib/db.ts`
- Generated types import path: `@/generated/prisma/client`
- Auth helper: `src/lib/auth.ts` (export `auth`)
- Credit helpers: `src/lib/credits.ts` (`getAvailableCredits`, `deductCredits`, `refundCredits`)
- Workshop tool registry: `src/lib/workshop/tools.ts` (`WORKSHOP_TOOLS`, `getToolBySlug`, `getWorkflowTypeForTool`)
- Workshop POST handler (to refactor): `src/app/api/workshop/[tool]/route.ts`
- Workshop poll endpoint: `src/app/api/workshop/poll/route.ts`
- Generation status endpoint: `src/app/api/generate/[id]/status/route.ts`
- Recent generations endpoint: `src/app/api/generate/route.ts` (GET)
- Settings card pattern: `src/app/(app)/settings/settings-client.tsx` (`ProfileSection`)
- Settings page composition: `src/app/(app)/settings/page.tsx`
- Settings API pattern: `src/app/api/settings/profile/route.ts`, `src/app/api/settings/content-mode/route.ts`
- Error sanitizer: `src/lib/errors.ts` (`sanitizeClientError`, `FALLBACK_GENERIC`)
- R2 helpers: `src/lib/r2.ts` (`uploadToR2`, `getSignedR2Url`)
- SSRF-safe fetch (use for any user-supplied URL the MCP server downloads): `src/lib/security/safe-fetch.ts` (`safeFetchUserUrl`)
- Env file: `c:/Users/tanne/artifacial/.env.local`