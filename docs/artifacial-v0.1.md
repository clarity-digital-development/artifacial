# Artifacial v0.1 — Foundation

**Date**: 2026-03-05
**Status**: Local development — not yet deployed

---

## Overview

v0.1 establishes the full project foundation: scaffolding, design system, and the Character Studio feature (the primary user hook). No database is connected yet — the schema is defined and generated but no migrations have been run against a live database.

---

## What's Included

### 1. Project Scaffolding

- Next.js 16.1.6 with App Router, TypeScript, Tailwind CSS v4
- Prisma 7 ORM with PostgreSQL schema (9 models)
- NextAuth v5 (beta) with Google OAuth + Prisma adapter
- Stripe integration (lazy-loaded) with plan definitions, credit packs, and webhook handler
- Cloudflare R2 file storage utilities
- BullMQ dependency installed (queue not yet wired)
- Anthropic SDK installed (prompt enhancement not yet wired)
- Auth middleware protecting all `/app` routes
- 23 routes registered (13 pages, 10 API)

### 2. Design System

**Philosophy**: Dark cinematic "screening room" — not a typical SaaS dashboard.

**CSS Variables** (defined in `globals.css`):
- Background scale: `--bg-deep` (#0A0A0B) → `--bg-surface` → `--bg-elevated` → `--bg-input`
- Accent: `--accent-amber` (#E8A634) with dim, glow variants
- Text: `--text-primary` (warm off-white) → `--text-secondary` → `--text-muted`
- Full radius, spacing, and typography scales

**Fonts**: Syne (display), DM Sans (body) — loaded via `next/font/google`

**Atmospheric Effects**:
- Film grain overlay (SVG noise at 4% opacity)
- Ambient warm light gradient (upper-left radial)
- Vignette (inset box-shadow)
- Custom thin scrollbar

**Animations**:
- `animate-amber-sweep` — progress bar generation indicator
- `animate-fade-in-up` — page content entrance
- `animate-fade-in-scale` — video/image reveal
- `animate-pulse-glow` — active element pulsing
- `stagger-reveal` — orchestrated child animations (100ms delay each)

**Components** (`src/components/ui/`):
| Component | Variants | Notes |
|-----------|----------|-------|
| Button | primary, secondary, ghost, danger × sm, md, lg | Focus ring, disabled state, fullWidth option |
| Input | — | Label, error state, amber focus ring |
| Textarea | — | Same API as Input |
| Select | — | Custom chevron, native `<select>` |
| Card | hover, glow | Lift + warm glow on hover, film-style shadow |
| Badge | default, amber, success, error | Pill-shaped status indicators |
| PillToggle | — | Tab/option switcher (e.g. "From Photo" / "From Description") |
| ProgressBar | static, animated | Amber sweep animation for generation states |

### 3. Character Studio

**Character Creation** (`/characters/new`):
- Split-view layout: controls (40%) | preview (60%)
- Two creation modes via pill toggle: "From Photo" (drag-and-drop upload) and "From Description" (textarea)
- Fields: Character Name, Style Description (optional), Output Style (Photorealistic/Cinematic/Stylized/Anime)
- "Generate Character" triggers 4 concurrent Gemini API calls (front, ¾ left, ¾ right, full body)
- SSE streaming delivers each completed image to the 2x2 preview grid as it finishes
- Preview grid has viewfinder corner notches, amber sweep loading animation, per-angle regenerate buttons
- "Save Character" persists to database, "Regenerate All" re-runs generation

**Character Library** (`/characters`):
- Responsive grid of character cards (portrait 3:4 aspect ratio)
- Hover lift + glow effect on cards
- Empty state with centered CTA: "Cast your first character"
- "+ New Character" card with dashed border at grid start

**Character Detail** (`/characters/[id]`):
- 4-column reference image grid with viewfinder corners and angle labels
- Character metadata (name, style badge, creation date, description)
- "Use in Project" and "Delete" actions

**Generation API** (`POST /api/characters/generate`):
- Credit validation (4 image credits required)
- Source photo upload to R2 (if "From Photo" mode)
- Style-prefixed prompt construction per angle
- 4 concurrent Gemini `gemini-2.0-flash-exp` requests
- Results uploaded to R2 as WebP
- SSE stream with per-image events + completion event
- Automatic credit refund for failed generations

**Character CRUD API** (`/api/characters`, `/api/characters/[id]`):
- GET: List all user characters / get single character
- POST: Create character record
- DELETE: Delete character (with ownership check)

---

## Database Schema (v0.1)

Models defined in `prisma/schema.prisma`:

- **User** — plan, imageCredits, videoCredits, stripeCustomerId
- **Account** / **Session** / **VerificationToken** — NextAuth adapter tables
- **Character** — name, description, style, sourceImage, referenceImages[], faceEmbedding
- **Project** — name, characterId, status, finalVideoUrl
- **Scene** — order, prompt, enhancedPrompt, duration, cameraPreset, status, videoUrl, anchor frames
- **GenerationJob** — type, status, queuePosition, timing, error
- **CreditTransaction** — type, imageCredits, videoCredits, description

No migrations have been run. Schema is generated to `src/generated/prisma/`.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework |
| react / react-dom | 19.2.3 | UI |
| prisma / @prisma/client | 7.4.2 | ORM |
| @prisma/adapter-pg / pg | 7.4.2 / 8.20.0 | Prisma PostgreSQL driver |
| next-auth | 5.0.0-beta.30 | Authentication |
| @auth/prisma-adapter | 2.11.1 | NextAuth ↔ Prisma |
| stripe / @stripe/stripe-js | 20.4.0 / 8.9.0 | Payments |
| bullmq | 5.70.2 | Job queue (not yet wired) |
| @aws-sdk/client-s3 | 3.1002.0 | R2 file storage |
| @anthropic-ai/sdk | 0.78.0 | Prompt enhancement (not yet wired) |
| tailwindcss | 4.x | Styling |

---

## What's NOT in v0.1

- No live database connection (schema only, no migrations)
- No video generation (API stubs return 501)
- No BullMQ queue wiring
- No prompt enhancement via Claude Haiku
- No Stripe Checkout flows (webhook handler exists but no frontend triggers)
- No Studio home screen (placeholder page)
- No Scene Builder (placeholder page)
- No Gallery or Settings functionality
- No deployment configuration
- No tests

---

## Next Up (v0.2)

- Studio home screen with quick-create prompt bar, character casting reel, and project film strips
- Scene Builder with film strip timeline, scene editor, and video preview
- Connect to a live PostgreSQL database and run migrations
