# Studio Mobile Redesign — Design Spec

## Overview

On desktop, the Studio page uses a two-panel layout: settings on the left, generation output on the right. On mobile, this collapses into a full-screen output view with a bottom-triggered settings sheet. The goal is zero compromises on functionality while giving the generation output maximum screen real estate.

---

## Breakpoint

All behavior described below activates at `max-width: 768px`. Above 768px, the existing desktop layout is unchanged.

---

## Mobile Layout Structure

### Default State (Settings Sheet Closed)

The screen has three layers:

1. **Top bar** — sticky, same as desktop (Studio title, SFW/NSFW toggle, credits display, avatar)
2. **Main area** — full viewport, shows generation output or empty state
3. **Bottom button** — sticky at bottom, triggers the settings sheet

```
+-----------------------------+
|  Studio          SFW 1,000cr|  <- top bar (sticky)
+-----------------------------+
|                             |
|                             |
|   [Generated video here]    |  <- full screen output area
|                             |
|                             |
|  +---------------------+   |
|  | Prompt text used...  |   |  <- generation details card
|  | Kling 3.0 . 5s . 1080p  |     (appears after generation)
|  | 3,100 cr . no audio |   |
|  +---------------------+   |
|                             |
+-----------------------------+
|  [+ New Generation]        |  <- sticky bottom button
+-----------------------------+
```

**Empty state** (no generations yet): The main area shows the dashed-border placeholder with "Configure your settings and tap New Generation to start" — same concept as desktop but reworded for the mobile flow.

### Bottom Button

- Sticky to bottom of viewport, full width with horizontal padding (16px sides)
- Height: 56px
- Background: primary gold/amber (`var(--accent-amber)`)
- Text: "New Generation" with a `+` or sparkle icon left of text
- Border-radius: 12px (or match existing button radius)
- Bottom margin: 16px (safe area aware — add `env(safe-area-inset-bottom)` padding on notched devices)
- `z-index` above main content, below the settings sheet

---

## Settings Sheet

### Trigger

Tapping the bottom button opens the settings sheet as a bottom sheet overlay.

### Sheet Behavior

- Slides up from the bottom with a 300ms ease-out transition
- **Backdrop**: semi-transparent black overlay (`rgba(0,0,0,0.5)`) behind the sheet, tapping it closes the sheet
- **Height**: auto based on content, but max 85vh (leave the top bar visible so the user doesn't feel trapped)
- **Drag handle**: 40px wide x 4px tall rounded pill centered at top of sheet, `rgba(255,255,255,0.3)`, 12px top padding
- Optional: support drag-to-dismiss (swipe down closes), but not required for v1
- Border-radius: 16px on top-left and top-right corners
- Background: match existing sidebar/panel background color (the dark surface from your current left panel)

### Sheet Content — Top to Bottom

```
+-----------------------------+
|          -- (drag handle)   |
|                             |
|  Text->Video  Img->Video  Motion  <- tab row
|                             |
|  MODEL                      |
|  +---------------------+   |
|  | Kling 3.0 Pro       v|   |  <- model dropdown
|  | 1080p . up to 15s    |   |
|  +---------------------+   |
|                             |
|  [ ] Generate with audio    |  <- audio toggle
|                             |
|  PROMPT                     |
|  +---------------------+   |
|  | Describe your scene. |   |  <- textarea
|  |                      |   |
|  |                      |   |
|  +---------------------+   |
|                    0/2000   |
|                             |
|  5s    16:9                 |  <- duration + aspect pills
|                             |
|  [Generate -- 3,100 cr]    |  <- generate button (full width)
|                             |
|  (safe area padding)        |
+-----------------------------+
```

### Content Details

1. **Tab row** (Text->Video / Image->Video / Motion)
   - Same tabs as desktop, horizontally scrollable if needed
   - Active tab uses the existing highlight style (gold/amber fill)
   - Height: 44px

2. **Model dropdown**
   - Full width, same component as desktop
   - Shows model name as primary text, resolution + duration + credit cost as subtitle
   - Tapping opens the existing model selection dropdown/modal

3. **Audio toggle**
   - Checkbox + label
   - When toggled ON, the credit cost on the generate button updates immediately
   - Show the audio credit surcharge inline: "Generate with audio (+1,000 cr)" when checked

4. **Prompt textarea**
   - Full width, min-height 100px, max-height 160px (don't let it eat the whole sheet)
   - Auto-grows with content up to max
   - Character count bottom-right, same as desktop
   - On focus, the sheet should scroll so the textarea and generate button remain visible above the keyboard. This is the hardest part — test on iOS Safari specifically

5. **Duration + Aspect ratio pills**
   - Horizontal row of pill/chip buttons, same as desktop
   - If more options exist than fit on screen, horizontally scroll

6. **Generate button**
   - Full width with 16px horizontal padding
   - Same gold/amber style as the current desktop generate button
   - Text: "Generate -- {totalCredits} cr"
   - `totalCredits` = base credits + audio credits (if audio toggled on)
   - Must update live as user changes model, duration, resolution, or audio toggle

### Sheet State Persistence

- When the sheet closes (after generate or backdrop tap), **all settings are retained in state**
- When the user re-opens the sheet, prompt text, model selection, duration, aspect ratio, and audio toggle are all exactly as they left them
- The user should be able to re-open -> tweak one thing -> re-generate without re-entering anything

---

## Generation Output Area

### While Generating

- The settings sheet closes immediately when "Generate" is tapped
- Main area shows a loading state: progress indicator or skeleton with the model name and "Generating..." text
- The bottom button changes to disabled state with text "Generating..." or shows a subtle progress indicator
- Do not allow opening the settings sheet while a generation is in progress (or if you do, disable the generate button inside it)

### After Generation Completes

The video player renders in the main area, followed by a generation details card.

#### Video Player
- Full width, aspect ratio maintained (16:9, 9:16, 1:1 depending on what was generated)
- Native video controls (play/pause, scrub, fullscreen)
- Auto-play on completion is fine but muted by default (mobile browsers require this anyway)

#### Generation Details Card

Appears directly below the video. This is the "receipt" for what was generated.

```
+-----------------------------+
|  "The prompt text that was   |
|  used for this generation    |
|  goes here, full text..."    |
|                              |
|  Kling 3.0 . 1080p . 5s     |  <- model . resolution . duration
|  Audio: Yes . 4,100 cr       |  <- audio status . credits used
|  2:34 PM                     |  <- timestamp
+-----------------------------+
```

- Background: slightly elevated surface (subtle border or background shift from the main area)
- Prompt text: regular weight, full text shown (not truncated)
- Metadata line: smaller text, muted color, model + settings as a single line
- Credits used: show actual amount deducted
- Padding: 16px all sides
- Border-radius: 12px
- Margin: 16px from video player, 16px horizontal

### Generation History (Scrolling)

If the user generates multiple times, each generation stacks vertically in the main area — newest on top. Each entry is a video player + details card pair. The user scrolls through their session history naturally.

For the "Select a generation to view details" panel that exists on the right side of desktop — on mobile, this is eliminated. The details card beneath each video replaces it.

---

## Image->Video Tab

When the user switches to Image->Video in the settings sheet, an image upload area appears between the model dropdown and the prompt field:

```
|  MODEL                      |
|  +---------------------+   |
|  | Kling 3.0 Pro       v|   |
|  +---------------------+   |
|                             |
|  REFERENCE IMAGE            |
|  +---------------------+   |
|  |   [+] Tap to upload  |   |  <- image upload zone
|  |   or drag and drop   |   |
|  +---------------------+   |
|                             |
|  [ ] Generate with audio    |
|  ...                        |
```

- Image preview replaces the upload zone once an image is selected
- Tap the preview to replace/remove
- Keep the sheet scrollable so the generate button is always reachable

---

## Edge Cases

### Keyboard Open (iOS/Android)

When the prompt textarea is focused and the software keyboard opens:
- The sheet must scroll so the textarea remains visible
- The generate button should ideally remain visible or be at most one small scroll away
- Do NOT let the keyboard push the sheet off-screen entirely
- On iOS Safari, use `visualViewport` API to handle keyboard resize if needed

### Insufficient Credits

If the user doesn't have enough credits for the selected configuration:
- Generate button becomes disabled (dimmed, no tap response)
- Text changes to "Not enough credits -- {cost} cr"
- Optionally show a small "Get more credits" link below the button

### Generation Failure

- Video area shows an error state with the prompt/settings still visible in the details card
- The bottom button returns to "New Generation" state
- Settings sheet retains all previous values so the user can retry immediately

### Landscape Orientation

- Settings sheet max height becomes 90vh (more vertical space needed in landscape)
- Video player maintains aspect ratio, doesn't stretch
- No other special handling needed — the vertical stack still works

### Safe Areas (Notch Devices)

- Bottom button: add `padding-bottom: env(safe-area-inset-bottom)` to its container
- Settings sheet: same safe area padding at the bottom below the generate button
- Top bar: add `padding-top: env(safe-area-inset-top)` if not already handled

---

## Transition & Animation

| Action | Animation | Duration | Easing |
|--------|-----------|----------|--------|
| Sheet opens | Slide up from bottom | 300ms | ease-out |
| Sheet closes (generate) | Slide down | 250ms | ease-in |
| Sheet closes (backdrop tap) | Slide down | 250ms | ease-in |
| Backdrop fade in | Opacity 0 -> 0.5 | 300ms | linear |
| Backdrop fade out | Opacity 0.5 -> 0 | 250ms | linear |
| Generation loading | Pulse/skeleton | continuous | -- |
| Video appears | Fade in | 200ms | ease-in |

---

## Component Summary

New components needed:

1. **`StudioBottomButton`** — sticky bottom CTA, "New Generation" / "Generating..."
2. **`StudioSettingsSheet`** — bottom sheet container with backdrop, drag handle, slide animation
3. **`GenerationDetailsCard`** — prompt + metadata display below each video output

Modified components:

4. **Existing settings panel** — contents move into `StudioSettingsSheet` on mobile, no layout changes to the controls themselves
5. **Generate button** — lives inside the sheet on mobile instead of inline in the sidebar
6. **Generation output area** — becomes full-screen on mobile, stacks vertically with details cards

No new components needed for the controls themselves (model dropdown, prompt textarea, duration/aspect pills, audio toggle) — they just live inside the sheet instead of the sidebar.

---

## Implementation Notes

### Current Architecture

- `generate-client.tsx` is ~1,500 lines with a rigid three-panel flex layout (320px left + flex center + 300px right)
- No existing mobile responsiveness — panels are fixed pixel widths
- All form state lives in the client component via `useState`

### Recommended Approach

Extract the settings panel content (tabs, model selector, prompt, pills, generate button) into a shared `StudioSettingsContent` component. On desktop, render it inside the existing left panel. On mobile, render it inside the `StudioSettingsSheet` bottom sheet. This avoids duplicating form logic and keeps the controls identical across both layouts.

Use a `useIsMobile()` hook (based on `window.matchMedia('(max-width: 768px)')`) to conditionally render the desktop three-panel layout vs the mobile single-panel + bottom sheet layout.
