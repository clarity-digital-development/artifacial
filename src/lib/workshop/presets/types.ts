/**
 * Shared scene-template type used by Photodump, Headshot Generator, and any
 * future multi-image batch preset that takes a character reference and emits
 * a curated set of stylized images.
 *
 * The character image is always passed as `image_urls[0]` to Nano Banana Pro
 * and referenced in the prompt's identity-locking tail.
 */
export interface SceneTemplate {
  /** Stable identifier — used as the per-item slug in the batch */
  slug: string;
  /** Short display label shown in the result grid */
  label: string;
  /** Aspect ratio for this specific scene */
  aspectRatio: "3:4" | "4:3" | "1:1";
  /** The full prompt sent to Nano Banana Pro (character image is image_urls[0]) */
  prompt: string;
}
