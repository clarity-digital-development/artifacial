/**
 * Photodump scene pack — 12 curated scene templates that turn one character
 * reference image into a "photodump" of varied lifestyle / editorial / cinematic
 * looks. Designed to mimic Higgsfield's Soul Photodump funnel — high signal
 * for "this is what my AI character looks like across contexts" with one click.
 *
 * Each scene composes into a Nano Banana Pro prompt with the reference image
 * fed in via image_urls[0]. The first 1-2 sentences describe the scene; the
 * tail enforces consistent identity capture from the reference.
 */

export interface PhotodumpScene {
  /** Stable identifier — used as the photodump item index */
  slug: string;
  /** Short display label for the result grid */
  label: string;
  /** Aspect ratio for this specific scene (3:4 portrait, 4:3 landscape, 1:1) */
  aspectRatio: "3:4" | "4:3" | "1:1";
  /** The prompt sent to Nano Banana Pro (character image is image_urls[0]) */
  prompt: string;
}

/**
 * Identity-locking suffix appended to every scene prompt so the generation
 * preserves likeness from the reference image instead of drifting.
 */
const IDENTITY_SUFFIX =
  "The person must be identical to the reference image — same face, same hair, same skin tone, same identifying features. Photorealistic studio-grade quality.";

export const PHOTODUMP_SCENES: PhotodumpScene[] = [
  {
    slug: "golden-hour-portrait",
    label: "Golden Hour Portrait",
    aspectRatio: "3:4",
    prompt:
      `Cinematic close-up portrait of the person from the reference image during golden hour, soft backlit warm sunlight catching the edge of their hair, slight smile, looking just off-camera, blurred sunset background, shot on a 85mm lens, shallow depth of field, professional fashion photography. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "editorial-cover",
    label: "Editorial Cover",
    aspectRatio: "3:4",
    prompt:
      `Premium fashion-magazine editorial cover photograph of the person from the reference image. Dramatic single-key studio lighting, sharp focus on the face, dark seamless background, glossy print quality, magazine-cover composition with negative space for masthead, Vogue / GQ-level production value. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "tokyo-night",
    label: "Tokyo Night",
    aspectRatio: "3:4",
    prompt:
      `The person from the reference image walking through a neon-lit Tokyo street at night. Towering signage in Japanese kanji glowing pink and cyan around them, wet pavement reflections, faint atmospheric mist, cinematic 35mm film aesthetic, Blade-Runner mood, dressed in stylish modern streetwear. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "paris-cafe",
    label: "Paris Café",
    aspectRatio: "4:3",
    prompt:
      `The person from the reference image sitting at a Parisian sidewalk café in the morning, soft window light falling on them, holding an espresso cup, classic Haussmannian facades blurred in the background, candid lifestyle photography aesthetic, warm autumn tones, dressed in chic neutral knitwear. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "beach-sunset",
    label: "Beach Sunset",
    aspectRatio: "3:4",
    prompt:
      `The person from the reference image standing at the edge of the surf at sunset, gentle sea breeze in their hair, golden-pink sky behind them, soft warm rim lighting, ocean horizon, casual coastal styling, dreamy lifestyle photography. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "cyberpunk-rain",
    label: "Cyberpunk Rain",
    aspectRatio: "3:4",
    prompt:
      `The person from the reference image standing in a rain-soaked cyberpunk alley at night. Glowing pink and cyan neon signs reflecting off the wet pavement, atmospheric haze, dark cloak or trenchcoat, dramatic backlit silhouette, moody high-contrast color grading. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "mountain-sunrise",
    label: "Mountain Sunrise",
    aspectRatio: "4:3",
    prompt:
      `The person from the reference image standing on a windswept mountain peak at sunrise. Vast cloud sea below them, golden first light hitting their face, dressed in technical outdoor wear, epic cinematic scale, dramatic atmospheric haze, National-Geographic adventure aesthetic. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "studio-fashion",
    label: "Studio Fashion",
    aspectRatio: "3:4",
    prompt:
      `Three-quarter body high-fashion studio portrait of the person from the reference image against a deep black seamless backdrop. Strong single-key octabox lighting, sharp catchlights in the eyes, glossy commercial print quality, modern minimalist styling. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "exec-portrait",
    label: "Executive Portrait",
    aspectRatio: "3:4",
    prompt:
      `Professional executive portrait of the person from the reference image in a modern corner-office boardroom. Soft natural window light from the side, dressed in a tailored modern suit, calm confident expression, blurred floor-to-ceiling windows behind, polished editorial business photography. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "tropical-vacation",
    label: "Tropical Vacation",
    aspectRatio: "4:3",
    prompt:
      `Vibrant lifestyle photograph of the person from the reference image on a tropical beach vacation. Crystal-blue water and white sand behind them, palm trees gently blurred, golden afternoon light, casual relaxed expression, dressed in beachwear, summer vacation photo-dump aesthetic. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "vintage-yearbook",
    label: "Vintage Yearbook",
    aspectRatio: "3:4",
    prompt:
      `Stylized vintage 1990s high-school yearbook portrait of the person from the reference image. Classic blue gradient marbled photo-studio backdrop, retro 90s styling and hair, slight film grain, warm color cast, awkward warmly-lit yearbook lighting, nostalgic Polaroid quality. ${IDENTITY_SUFFIX}`,
  },
  {
    slug: "red-carpet-photodump",
    label: "Red Carpet",
    aspectRatio: "3:4",
    prompt:
      `The person from the reference image on a glamorous red carpet at a film premiere, paparazzi camera flashes firing on both sides creating dramatic lens flares, wearing elegant evening attire, warm golden cinematic key light on their face, premiere step-and-repeat backdrop behind them. ${IDENTITY_SUFFIX}`,
  },
];

/** Convenience: get scene by slug for poll/result wiring */
export function getPhotodumpScene(slug: string): PhotodumpScene | undefined {
  return PHOTODUMP_SCENES.find((s) => s.slug === slug);
}

export const PHOTODUMP_SCENE_COUNT = PHOTODUMP_SCENES.length;
