/**
 * Headshot Generator scene pack — 6 curated studio-headshot variations
 * generated in parallel via Nano Banana Pro. Output is a polished mini-set
 * of professional headshots from one reference photo: corporate, actor,
 * LinkedIn, fashion editorial, casual creative, fitness.
 *
 * Pricing target: 6 × 450 cr = 2,700 cr (75% margin on $0.105 × 6 = $0.63).
 *
 * Architecture mirrors photodump-scenes.ts — shared SceneTemplate type +
 * the same parallel-batch submission helper in the workshop POST handler.
 */

import type { SceneTemplate } from "./types";

const IDENTITY_SUFFIX =
  "The person must be identical to the reference image — same face, same hair, same skin tone, same identifying features. Photorealistic studio-grade quality.";

export const HEADSHOT_SCENES: SceneTemplate[] = [
  {
    slug: "corporate",
    label: "Corporate",
    aspectRatio: "3:4",
    prompt:
      `Polished corporate headshot of the person from the reference image. Soft seamless neutral grey backdrop, sharp single-key softbox lighting from camera-right with subtle fill on the left, dressed in a tailored modern business suit or blouse, confident relaxed smile, three-quarter angle, looking directly at camera. Print-magazine quality, used for annual-report or executive bio. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "actor",
    label: "Actor Headshot",
    aspectRatio: "3:4",
    prompt:
      `Theatrical actor headshot of the person from the reference image. Dark grey seamless studio backdrop, dramatic Rembrandt lighting from the upper-left, deep catchlights in the eyes, neutral wardrobe (plain dark t-shirt or simple jacket), expressive but composed face, tight close-up framing from the upper chest up, classic Los Angeles agency headshot aesthetic. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "linkedin",
    label: "LinkedIn Profile",
    aspectRatio: "1:1",
    prompt:
      `Approachable LinkedIn profile portrait of the person from the reference image. Soft natural window light from the side, blurred warm modern office interior in the background, dressed in business-casual smart attire (button-up or sweater), warm genuine smile, relaxed posture, head and shoulders framing, the kind of portrait that gets recruiter clicks. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "fashion-editorial",
    label: "Fashion Editorial",
    aspectRatio: "3:4",
    prompt:
      `High-fashion editorial headshot of the person from the reference image. Black seamless backdrop, dramatic single-source rim lighting carving out their silhouette, designer-styled minimalist wardrobe, sharp focus on the eyes, intense direct gaze, glossy commercial print quality. Magazine-cover-grade composition. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "creative-casual",
    label: "Creative Casual",
    aspectRatio: "3:4",
    prompt:
      `Warm modern creative-professional portrait of the person from the reference image. Soft natural daylight from a large nearby window, casual sweater or denim jacket, relaxed posture, subtly blurred warm modern home or coworking-space background with plants, candid genuine half-smile, three-quarter framing. Lifestyle photography aesthetic that feels approachable, used for personal-brand websites. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "fitness-athletic",
    label: "Fitness Athletic",
    aspectRatio: "3:4",
    prompt:
      `Athletic portrait of the person from the reference image in a modern gym or training-studio environment. Dramatic side-lit lighting with high contrast, subtle sweat sheen, athletic technical wear, focused intense expression looking off-camera, blurred equipment in background, magazine-cover sports-photography quality. ${IDENTITY_SUFFIX}`,
  },
];

export const HEADSHOT_SCENE_COUNT = HEADSHOT_SCENES.length;
