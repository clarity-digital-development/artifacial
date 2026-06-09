I now have a complete picture. Here's the report.

---

# Higgsfield Marketing Studio — UX Investigation Report

## 1. Entry Flow (what the user does FIRST)

The flow is **product-first, not mode-first**. On `/marketing-studio-intro`, the headline is **"Marketing Studio — One prompt, your entire campaign"** with a single primary CTA: **"Start creating"**.

Inside the studio, step 1 of the documented "How to start" sequence is **"Add your product — Paste a URL or upload images manually."** The system then auto-extracts product name, description, up to 8 photos, brand colors, and logo. (Source: [marketing-studio-intro](https://higgsfield.ai/marketing-studio-intro), [How to Create Instant Ads](https://higgsfield.ai/blog/How-to-Create-Instant-Ads))

The 4-step canonical flow is:
1. **Add your product** — Paste URL or upload up to 5–8 images
2. **Pick an avatar** — 40+ library avatars OR generate a custom one with Soul 2.0
3. **Choose a mode** — UGC / Professional / General buckets
4. **Hit generate** — "Ad-ready video, no post-production needed"

So **mode selection is step 3**, not step 1. The URL is the unlock.

## 2. Input Shape

| Input | Required? | Notes |
|---|---|---|
| Product URL **or** 1–8 product images | Required (one of) | URL auto-extracts name, description, images, brand colors, logo |
| Product name + description | Auto-filled, editable | Manual override available |
| Brand colors + logo | Auto-extracted, editable | Used to "style the video frames" |
| Avatar | Required for UGC modes | Pick from 40+ library or text-prompt-generate via Soul 2.0 |
| Mode/preset | Required | One tap from a grid |
| Custom text prompt | Optional | "Detailed or minimal prompts" both work |
| Reference video/image | Optional | "Ad Reference" tool: upload a reference, attach your product |

Source: [marketing-studio-intro](https://higgsfield.ai/marketing-studio-intro), [How to Create Instant Ads](https://higgsfield.ai/blog/How-to-Create-Instant-Ads), [marketing-automation](https://higgsfield.ai/marketing-automation)

## 3. Output Flow

**Two modes of output depending on entry point:**

- **Per-mode generation:** Single ad-ready video, fixed aspect ratio per mode (9:16 vertical for UGC/Hyper Motion/Try-On; 16:9 for TV Spot), typically **~15 seconds**. (Source: [Build a Full Marketing Stack](https://higgsfield.ai/blog/marketing-studio-video-2))
- **Bulk / Hermes Agent flow:** Batch-generates **50+ A/B variants** across avatars in one job — marketed as "dozens of UGC videos in hours, not weeks." (Source: [VO3AI Hermes writeup](https://www.vo3ai.com/blog/higgsfield-marketing-studio-just-launched-5-ways-hermes-agent-is-changing-ai-ugc-2026-04-23))

No embedded script + storyboard pane shown in public copy. Output is a finished video file. Direct publish to Meta/Google is advertised as an integrated distribution feature.

## 4. Modes Available

Public marketing copy lists 9 core modes plus 2 toolkit features:

| Mode | One-liner (Higgsfield's words) |
|---|---|
| **Hyper Motion** | "Pure CGI, product as hero" — physics-based camera, Apple-reveal vibe |
| **Pro Virtual Try-On** | "Street-style editorial energy" — cinematic lifestyle |
| **UGC Virtual Try-On** | "Try it on, show it off" — casual creator energy |
| **UGC** | "Real person, real recommendation" — talking-head creator |
| **Product Review** | "Hands-on demo, all product" |
| **Tutorial** | "Step by step, on camera" |
| **Unboxing** | "First touch, real reaction" |
| **TV Spot** | "Cinematic ad, full narrative" — 16:9, character-led |
| **Wild Card** | "AI directs, you approve" — minimal input, max creative latitude |
| **Hooks** (toolkit) | 25+ hook variations: cold opens, POV setups, pattern interrupts, story hooks — for opener clips |
| **Ad Reference** (toolkit) | Upload a reference video, attach your product, get a same-style ad |

Sources: [marketing-studio-intro](https://higgsfield.ai/marketing-studio-intro), [Higgsfield on X re: Hooks](https://x.com/higgsfield/status/2052026995064913974), [marketing-automation](https://higgsfield.ai/marketing-automation)

## 5. Pricing

**Not disclosed per-mode.** Higgsfield does not publish a credit-per-Marketing-Studio-mode table. Pricing is just the global credit pool.

| Plan | Annual rate | Monthly rate | Credits/mo |
|---|---|---|---|
| Basic | $5/mo | $5/mo | 70 |
| Plus | $39/mo | $49/mo | 1,000 |
| Ultra | $99/mo | $129/mo | 3,000 (up to 9,000) |
| Business | $62/seat/mo | $71/seat/mo | 1,500/seat (3,000 min) |

Per-model reference costs (apply across the platform, not Marketing-Studio-specific): Kling 3.0 720p ~7 credits / 5s; Veo 3 with audio 720p ~58 credits / 8s; Nano Banana Pro 2 credits/image. (Source: [Imagine.art pricing breakdown](https://www.imagine.art/blogs/higgsfield-ai-pricing))

Implication: a 15-second Marketing Studio video lands roughly in the 20–175 credit range depending on which underlying model the mode invokes — but Higgsfield deliberately hides this in the UI.

## 6. First Thing a New User Sees on /marketing-studio

The main `/marketing-studio` page is **gated behind auth** (HTTP 404 on `/marketing` and a stripped shell on `/marketing-studio` for unauthenticated visitors). The public-marketing equivalent is `/marketing-studio-intro`.

There, the primary visible elements are:
- **Headline:** "Marketing Studio — One prompt, your entire campaign"
- **Sub-headline (on /marketing-automation):** "ADD YOUR LINK AND WATCH ADS CREATE THEMSELVES"
- **Most-obvious primary CTA:** **"Start creating"** (also surfaced as "Start now," "Try Now," "Generate your ad," "Try Marketing Studio")

So the dominant cognitive frame is: **"paste a link → ads create themselves."** The mode picker is sold as a downstream choice, not the lead.

Sources: [marketing-studio-intro](https://higgsfield.ai/marketing-studio-intro), [marketing-automation](https://higgsfield.ai/marketing-automation), [/marketing-studio (gated)](https://higgsfield.ai/marketing-studio)

---

## 5 UX Shortcuts for Artifacial's 1-Day V1

### Shortcut 1 — Skip 6 of the 9 modes. Ship 3: **UGC**, **TV Spot**, **Hyper Motion**.
Why: those three cover the three actual buyer intents (creator-style, brand-style, product-hero). Drop **Product Review**, **Tutorial**, **Unboxing**, **UGC Virtual Try-On**, **Pro Virtual Try-On**, **Wild Card**. Try-On requires garment-segmentation work we don't have; Wild Card is a marketing gimmick on top of UGC; Review/Tutorial/Unboxing are UGC with different prompts — collapse them into a "Style" dropdown on UGC if needed.

### Shortcut 2 — Require URL **OR** image upload; make everything else optional with smart defaults.
Higgsfield auto-extracts 5 fields (name, description, photos, brand colors, logo) from the URL. We don't need to ship the brand-color/logo extraction on day one. Required inputs for V1: **one product image** (uploaded or scraped from URL) + **mode**. Auto-default avatar to a single "house creator." Skip brand color extraction, skip logo overlay, skip the "rewrite description" editor.

### Shortcut 3 — Defer the bulk/A-B variant pipeline. One job → one video.
Higgsfield's "50+ variants in a batch" is the Hermes Agent feature — it's their biggest differentiator and also their hardest engineering surface (job-fanout, variant naming, gallery diffing). For V1, generate one 8-second clip per click. Tell users "regenerate for variants" — Higgsfield itself charges that way under the hood (credits per generation, not per batch).

### Shortcut 4 — Skip avatar selection entirely. Use the user's existing Character.
Higgsfield's "Pick an avatar — 40+ in the library or Soul 2.0 custom" is a new surface area (library, search, custom-gen flow). Artifacial already has Characters. Wire Marketing Studio to default to the user's most-recently-used Character, with a single dropdown to switch. No library page, no Soul-2.0-equivalent in V1.

### Shortcut 5 — Skip the "Hooks" opener tool and ad-reference upload.
Hooks is a 25-preset library — that's content work, not engineering. Ad Reference (upload-a-reference-video, copy-the-style) needs a style-transfer pipeline we don't have. Both are deferrable. Also defer: brand-color extraction, logo overlay, Meta/Google direct publish, multi-aspect-ratio output (ship 9:16 only — TV Spot can be 9:16 cropped from the same model output, deal with 16:9 in V2).

### Bonus posture for V1's landing screen
Mimic Higgsfield's framing: **single input field — "Paste product URL or upload image"** — above a **3-tile mode picker** (UGC / TV Spot / Hyper Motion). Primary CTA literally labeled **"Generate ad"**. Don't show credit cost on the picker; show it only on the confirm modal (Higgsfield hides it entirely — we can split the difference and show it once, not on hover).

---

## Sources
- [Higgsfield Marketing Studio Intro (public marketing page)](https://higgsfield.ai/marketing-studio-intro)
- [Higgsfield Marketing Automation page](https://higgsfield.ai/marketing-automation)
- [Higgsfield Marketing Studio (gated app)](https://higgsfield.ai/marketing-studio)
- [Higgsfield Product Ad Generator](https://higgsfield.ai/marketing-studio/product)
- [Higgsfield AI Ad Generator](https://higgsfield.ai/ai-ad-generator)
- [Higgsfield Blog — How to Create Instant Ads (full workflow)](https://higgsfield.ai/blog/How-to-Create-Instant-Ads)
- [Higgsfield Blog — Build a Full Marketing Stack (mode aspect ratios + durations)](https://higgsfield.ai/blog/marketing-studio-video-2)
- [Imagine.art — Higgsfield AI Pricing 2026](https://www.imagine.art/blogs/higgsfield-ai-pricing)
- [VO3AI — Hermes Agent / Bulk Variants writeup](https://www.vo3ai.com/blog/higgsfield-marketing-studio-just-launched-5-ways-hermes-agent-is-changing-ai-ugc-2026-04-23)
- [Higgsfield on X — Hooks launch announcement](https://x.com/higgsfield/status/2052026995064913974)