# Artifacial — Project Context

## What is this?

Artifacial is a consumer-facing AI character creation and video generation platform. Users create persistent AI characters from selfies or text descriptions, then generate short-form videos featuring those characters. Target audience: non-technical creators from social media (Instagram, TikTok).

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Database**: PostgreSQL via Prisma 7 with `@prisma/adapter-pg`
- **Auth**: NextAuth v5 (beta) with Prisma adapter, Google OAuth
- **Payments**: Stripe (subscriptions + one-time credit packs)
- **Image Generation**: Google Gemini API (`gemini-2.0-flash-exp`)
- **Video Generation**: Kling 2.6 API (Phase 1) → ComfyUI on Thunder Compute (Phase 2)
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Job Queue**: BullMQ with Redis
- **Prompt Enhancement**: Claude Haiku via Anthropic API
- **Hosting**: Railway (planned, currently local dev only)

## Critical Architecture Notes

### Prisma 7
- `datasource` block in `prisma/schema.prisma` has NO `url` property — connection string lives in `prisma.config.ts`
- Generated client output is `src/generated/prisma/` — import `PrismaClient` from `@/generated/prisma/client`
- Constructor requires `{ adapter }` using `pg.Pool` + `PrismaPg` — see `src/lib/db.ts`
- After schema changes: run `npx prisma generate` then `npx prisma migrate dev`

### Auth / Middleware
- `src/lib/auth.config.ts` — Edge-safe config (NO Prisma imports). Used by middleware.
- `src/lib/auth.ts` — Full config with Prisma adapter. Server-side only.
- `src/middleware.ts` — Imports from `auth.config.ts` only. Prisma/Node.js modules crash Edge Runtime.

### Stripe
- Must be lazily initialized via `getStripe()` in `src/lib/stripe.ts` — crashes at build time without API key.
- Webhook at `/api/webhooks/stripe` handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.

### Gemini API
- REST API (not SDK). Model: `gemini-2.0-flash-exp`
- Image generation via `responseModalities: ["TEXT", "IMAGE"]`
- Returns base64 in `candidates[0].content.parts[].inlineData`
- Character generation fires 4 concurrent requests (front, ¾ left, ¾ right, full body)
- Results streamed to frontend via SSE

## Design System

Dark cinematic "screening room" aesthetic. Not a SaaS dashboard.

- **Colors**: Deep noir (`#0A0A0B` base) with warm amber accent (`#E8A634`)
- **Fonts**: Syne (display/headings), DM Sans (body) — loaded via `next/font/google`
- **Motion**: `cubic-bezier(0.22, 1, 0.36, 1)` easing, 150-200ms for interactions, 400-600ms for transitions
- **Textures**: Film grain overlay, ambient light gradient, vignette — applied via CSS classes `grain`, `ambient-light`, `vignette`
- **Components**: `src/components/ui/` — Button, Input, Textarea, Select, Card, Badge, PillToggle, ProgressBar

All CSS variables defined in `src/app/globals.css`.

## Project Structure

```
src/
├── app/
│   ├── (app)/           # Authenticated app routes
│   │   ├── layout.tsx   # Sidebar + TopBar + atmospheric textures
│   │   ├── studio/      # Main workspace (default after auth)
│   │   ├── characters/  # Library, /new (creation), /[id] (detail)
│   │   ├── projects/    # List, /[id] (scene builder)
│   │   ├── gallery/     # Completed videos
│   │   └── settings/    # Account + billing
│   ├── (auth)/          # Sign-in, sign-up
│   ├── (marketing)/     # Landing, pricing, examples (public)
│   ├── api/             # API routes
│   │   ├── auth/[...nextauth]/
│   │   ├── characters/  # CRUD + /generate (Gemini SSE)
│   │   ├── projects/    # CRUD + /[id]/scenes, /[id]/generate
│   │   ├── usage/       # Credit balance + history
│   │   └── webhooks/stripe/
│   ├── globals.css      # Design system variables + textures + animations
│   ├── layout.tsx       # Root layout with fonts
│   └── page.tsx         # Landing page
├── components/
│   ├── ui/              # Base components (Button, Input, Card, etc.)
│   ├── sidebar.tsx      # App navigation with SVG icons
│   ├── top-bar.tsx      # Section name + credits + avatar
│   ├── upload-zone.tsx  # Drag-and-drop photo upload
│   └── character-preview-grid.tsx  # 2x2 generation preview
├── lib/
│   ├── db.ts            # Prisma client singleton
│   ├── auth.ts          # NextAuth (server-side, with Prisma)
│   ├── auth.config.ts   # NextAuth (edge-safe, no Prisma)
│   ├── stripe.ts        # Stripe client + plan/pack definitions
│   ├── credits.ts       # Credit deduction/refund helpers
│   ├── r2.ts            # R2 upload/signed URL helpers
│   ├── gemini.ts        # Gemini image generation + prompts
│   ├── kling.ts         # Kling video API with JWT auth
│   └── characters.ts    # Character data helpers with signed URLs
├── generated/prisma/    # Auto-generated (gitignored)
└── middleware.ts         # Auth route protection
```

## Database Models

User, Account, Session, VerificationToken (NextAuth), Character, Project, Scene, GenerationJob, CreditTransaction — see `prisma/schema.prisma`.

## Credit System (Phase 1 — Unified Credits)

Uses a single universal credit currency. Two pools per user: `subscriptionCredits` (reset monthly) and `purchasedCredits` (rollover forever). Subscription credits consumed first.

### Credit Costs
- 1 image generation: 10 credits
- 1 character (4 angles): 40 credits
- 1 second of video: 40 credits
- 5-second video: 200 credits
- 10-second video: 400 credits

### Phase 1 Plans (Monthly Only)

| Plan    | $/mo  | Credits/mo |
|---------|-------|-----------|
| Free    | $0    | 100 (one-time, not monthly) |
| Starter | $15   | 750       |
| Creator | $50   | 2,500     |
| Pro     | $100  | 6,000     |

### Credit Packs (subscribed users only)
- 400 credits: $9.99
- 1,000 credits: $24.99

### Founding Member Program
Phase 1 subscribers get `isFoundingMember = true`. Benefits activate in Phase 2: permanent +20% credits, locked pricing, transition bonus.

Credits debited at job creation, refunded to `purchasedCredits` on failure.

## Build & Dev Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev  # Apply migrations locally
npx prisma studio    # Visual database browser
```

## Environment Variables

All defined in `.env.local` — see the template for the full list. Key groups: Auth (NextAuth + Google OAuth), Database, Stripe, Google AI (Gemini), Kling API, Cloudflare R2, Redis, Anthropic, ComfyUI.

## Build Order

1. [DONE] Project scaffolding
2. [DONE] Design system
3. [DONE] Character Studio
4. [DONE] Studio home screen
5. [DONE] Scene Builder (Phase 1)
6. [DONE] Generation system (BullMQ + Kling)
7. [DONE] Credits + Stripe integration (unified credits, founding member)
8. [DONE] Gallery + Settings
9. [DONE] Polish pass + deployment config
