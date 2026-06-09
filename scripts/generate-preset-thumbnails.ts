/**
 * Generate thumbnails for the 5 viral workshop presets using Google Gemini
 * (Nano Banana Pro: gemini-3-pro-image-preview).
 *
 * Each preset gets a 16:9 image saved to public/workshop-thumbs/{slug}.webp
 * Resized and converted via sharp.
 *
 * Usage: npx tsx scripts/generate-preset-thumbnails.ts
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { generateImageWithGemini } from "../src/lib/gemini";
import sharp from "sharp";
import { writeFile, access } from "fs/promises";
import path from "path";

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

type ThumbSpec = {
  slug: string;
  prompt: string;
};

const THUMBS: ThumbSpec[] = [
  // ── Sprint 1 (2026-06-05) — newly unhidden tools ──
  {
    slug: "photo-face-swap",
    prompt:
      "Cinematic split-screen before/after face-swap demonstration with sharp vertical divider. LEFT panel labeled 'BEFORE': a young East-Asian woman with straight jet-black hair and warm dark-brown eyes, gentle smile, wearing a cream knit sweater, soft window light in a cozy modern interior. RIGHT panel labeled 'AFTER': the EXACT same scene composition — identical cream knit sweater, identical pose, identical interior lighting and background, identical body — but the face is now a COMPLETELY DIFFERENT PERSON: a freckled fair-skinned redhead with bright green eyes and shoulder-length wavy copper-auburn hair. The two faces are obviously different people: different ethnicity, different hair color, different eye color, different bone structure. Labels are crisp small white sans-serif in opposite bottom corners. The face change is the only difference between the panels and it's instantly obvious at a glance.",
  },
  {
    slug: "multi-face-swap",
    prompt:
      "Group portrait photograph of four young adults at an outdoor café table, candid laughing. Subtle numbered translucent badges hovering over each person — '1', '2', '3', '4' in clean white sans-serif circles. Natural daylight, sharp focus, professional photography aesthetic. Demonstrates face-index control for swapping specific people in a group photo.",
  },
  {
    slug: "video-face-swap",
    prompt:
      "Two-row filmstrip composition demonstrating video face swap. TOP ROW labeled 'ORIGINAL': 4 consecutive video frames of a clean-shaven Asian man with short black hair speaking to camera in a cozy lamp-lit interior — slightly different expression in each frame (smiling, laughing, thoughtful, confident), warm cinematic color grading, TikTok-creator video aesthetic, thin black filmstrip borders between frames. BOTTOM ROW labeled 'FACE SWAPPED': 4 consecutive frames of the EXACT same scene — same olive button-up shirt, same warm lamp-lit interior, same expressions and gestures in matching order — but the face has been swapped to a COMPLETELY DIFFERENT MAN: a bearded Caucasian man with bright blue eyes, lighter skin, and dark brown hair. The two rows clearly show DIFFERENT PEOPLE: different ethnicity, different hair, different eye color, beard vs clean-shaven. Crisp small white sans-serif labels in the left margin of each row. The face change is the only difference between the two rows.",
  },
  {
    slug: "virtual-try-on",
    prompt:
      "Editorial split-screen fashion shot. Left: a young woman in a casual gray hoodie and jeans against a clean white studio background, full-body shot. Right: same woman in same pose and lighting but now wearing an elegant red evening dress instead. The transformation is the only difference. Glossy fashion-magazine quality. Subtle small labels 'BEFORE' and 'AFTER'.",
  },
  {
    slug: "ai-hug",
    prompt:
      "Heartwarming photograph of two young adults — a man and a woman — sharing a warm tight embrace, eyes closed, gentle smiles. Soft golden hour backlight, blurred park background, intimate emotional moment. Cinematic depth of field, warm color grade. Captures the feeling of reunion. Demonstrates AI Hug video generation.",
  },
  {
    slug: "lipsync",
    prompt:
      "Tight close-up portrait of a young woman mid-speech, mouth slightly open showing realistic lip motion, eyes focused at the camera, expressive face. Subtle audio-waveform graphic visible as a faint translucent overlay near her mouth, suggesting lip-sync audio sync. Cinematic studio lighting, magazine-quality realism. Modern minimalist composition.",
  },
  {
    slug: "effects",
    prompt:
      "Bold viral-effect grid thumbnail: 2x2 collage of four small action stills — top-left a person dramatically spinning with motion blur, top-right hearts floating in pink, bottom-left jumping with explosive water splash, bottom-right kung-fu kick with smoke trail. Each panel has slightly different color treatment. Thin black dividers between panels. TikTok creator-effects aesthetic, energetic, eye-catching.",
  },
  {
    slug: "kling-sound",
    prompt:
      "Dramatic video still of an action scene — a sports car at night with neon reflections — paired with a glowing translucent sound waveform graphic overlaying the lower third of the frame. Bold orange and white waveform lines pulsing across the image. Demonstrates AI sound generation for video. Cinematic, high-energy composition.",
  },
  {
    slug: "video-remove-bg",
    prompt:
      "A young woman standing in athletic pose, perfectly isolated from any background — clean alpha channel cutout. The background is a tasteful soft checkerboard pattern (transparent-style) indicating no background. Sharp edge separation on her hair, professional rotoscoping quality. Demonstrates clean background removal from video.",
  },
  {
    slug: "watermark-remover",
    prompt:
      "Cinematic split-screen before/after of a video frame. Left: a beautiful landscape shot with a large translucent watermark text 'SAMPLE FOOTAGE' overlaid in the corner and a faint diagonal repeating watermark pattern. Right: the exact same landscape shot with all watermarks cleanly removed, pristine. Subtle 'BEFORE' / 'AFTER' labels.",
  },
  {
    slug: "character-swap-remix",
    prompt:
      "Cinematic split image of a single young woman placed in two completely different scenes. Left: the woman in a snowy alpine mountain village at sunrise. Right: the same woman in the exact same outfit and pose but now standing on a rooftop overlooking Tokyo at night, with neon city lights. Identical character, different scenes. Demonstrates scene-remix capability.",
  },
  {
    slug: "remove-bg",
    prompt:
      "A young woman with brunette hair in a stylish denim jacket, isolated cleanly from any background — clean alpha cutout. Background is a tasteful soft transparency checkerboard pattern. Sharp edge details on her hair, professional cutout quality. Studio portrait look.",
  },
  {
    slug: "super-resolution",
    prompt:
      "Cinematic split-screen demonstrating image upscaling. Left half: a small, low-resolution, pixelated thumbnail-style image of a young woman with visible blockiness and JPEG artifacts. Right half: the same woman blown up to ultra-high resolution with razor-sharp detail — every eyelash, hair strand, and pore visible, magazine-quality clarity. Small labels '512px' and '4K' in opposite corners.",
  },
  {
    slug: "grok-video-upscale",
    prompt:
      "Cinematic split-screen of a video frame. Left: a soft, slightly blurry video frame of a person walking through a busy urban street, low-resolution feel, slight motion blur and softness. Right: the exact same frame but in ultra-high-resolution crisp 4K detail — sharp clothing texture, visible facial detail, every leaf on background trees. Subtle small labels '720p' and '4K'.",
  },
  {
    slug: "joycaption",
    prompt:
      "Modern minimalist composition: a glossy photograph of a young woman with red hair smiling on the left half, and on the right half a clean dark panel with white text in a typewriter font reading 'A young woman with shoulder-length red hair smiles confidently at the camera, wearing a green knit sweater. Soft natural window light…'. The text suggests structured AI-generated image captioning. Sharp typography, editorial layout.",
  },
  {
    slug: "trellis3d",
    prompt:
      "Cinematic composition showing a photograph of a person on the left side, and on the right side a glowing 3D wireframe mesh model of the same person emerging from the photo — translucent triangular mesh facets, slight blue-cyan glow lines on the wireframe edges, suggesting image-to-3D conversion. Dark background, technical-magic aesthetic. Demonstrates the Trellis 3D model generation.",
  },
  {
    slug: "music-gen",
    prompt:
      "Stylized album-cover aesthetic — a glowing musical waveform shaped abstractly to look like a soundwave through the frame, with translucent musical notes floating around it. Rich purple-and-orange gradient background, cinematic studio lighting feel. No text. Suggests AI music generation. Polished editorial album art quality.",
  },
  {
    slug: "add-audio",
    prompt:
      "A movie-poster-style video frame showing dramatic outdoor action — a stunt jumping over rocks at sunset — paired with a bold translucent stylized audio waveform graphic overlaying the lower portion of the frame. The waveform suggests added sound effects perfectly matching the visual action. Cinematic warm color grade.",
  },
  {
    slug: "diffrhythm",
    prompt:
      "Stylized album cover art with abstract flowing colored gradients (sunset oranges and deep blues), centered overlay of stylized song lyrics in elegant white script across the middle: 'Chasing the night / breaking the silence / we sing till the dawn'. Suggests AI-generated full songs with timed lyrics. Editorial album art quality, no other text.",
  },

  // ── Sprint 2 Wave 10 (2026-06-09) — 6 new viral presets ──
  {
    slug: "preset-underwater",
    prompt:
      "Ethereal cinematic underwater shot — a young woman with long hair gently floating around her, suspended in deep crystal-blue ocean depths, dappled god-rays of sunlight streaming down from the surface high above, soft bubbles rising past her, casual flowing clothing billowing softly. Dreamy depth-of-field, otherworldly dream-like atmosphere, cinematic blue-cyan color palette. 16:9 framing.",
  },
  {
    slug: "preset-vhs-90s",
    prompt:
      "Retro 90s MTV music-video still — a young woman performing in oversized neon streetwear against a graffitied urban brick backdrop, neon back-lighting in pink and cyan. Visible VHS scan lines and slight tape grain across the frame, subtle chromatic-aberration color bleed on edges, vintage CRT-screen vignette, slightly soft analog aesthetic. Confident music-video energy. 16:9 framing.",
  },
  {
    slug: "preset-catwalk",
    prompt:
      "High-fashion runway moment — a young woman walking confidently toward camera down a sleek dark runway, mid-stride in slow motion, dramatic side-spotlight, glamorous photographer-flash lens flares firing on both sides of the frame, premium designer outfit, intense focused gaze. Vogue fashion-week aesthetic, cinematic shallow depth of field. 16:9 framing.",
  },
  {
    slug: "preset-polaroid-70s",
    prompt:
      "Warm vintage 1970s Polaroid SX-70 photograph aesthetic — a young woman in retro 70s denim and knitwear styling, candid relaxed half-smile, sitting in a sun-drenched wood-paneled interior, sun-faded earthy color palette, subtle film grain, soft warm late-afternoon window light, slight chromatic shift. Nostalgic photo-album warmth. 16:9 framing.",
  },
  {
    slug: "preset-gym-action",
    prompt:
      "Magazine-cover fitness photograph — a young man at the apex of a dramatic heavy barbell lift in a dim industrial gym, chalk dust suspended in the air around him catching dramatic side-rim lighting, athletic compression-top and lifting belt, intense focused expression, beads of sweat on his face. Athletic-sponsor commercial energy, cinematic teal-orange color grade. 16:9 framing.",
  },
  {
    slug: "preset-action-hero",
    prompt:
      "Summer-blockbuster movie-poster composition — a young man as the cinematic action hero walking calmly and confidently directly toward the camera while a massive orange-and-black fireball explosion erupts behind him, debris and sparks suspended in the air, dust kicked up around his feet. Tactical wardrobe, intense focused expression, slow-motion swagger energy, cinematic teal-and-orange color grade. 16:9 framing.",
  },

  // ── Sprint 2 Wave 9 (2026-06-09) — Topaz Image Upscale ──
  {
    slug: "topaz-image-upscale",
    prompt:
      "Cinematic split-screen image upscale demonstration with sharp vertical divider. LEFT panel labeled '1×': a soft, slightly pixelated low-resolution close-up portrait of a young woman with visible JPEG artifacts and softness on her skin texture and hair. RIGHT panel labeled '8×': the exact same close-up portrait, identical pose and lighting, but in razor-sharp ultra-high-resolution detail — every individual eyelash, hair strand, skin pore, and fabric weave crisply visible, print-magazine quality. Crisp small amber labels '1×' and '8×' in opposite bottom corners. Demonstrates premium Topaz upscaling. 16:9 framing.",
  },

  // ── Sprint 4 Wave 18 (2026-06-09) — Marketing Studio merged into Workshop ──
  {
    slug: "marketing-studio",
    prompt:
      "Cinematic dark UI mockup of an AI marketing-ad workspace. Center-left: a glowing input field containing a product URL like 'yourstore.com/products/serum'. Below it, a single bold amber CTA button labeled 'Generate ad'. Center-right: a 9:16 phone-shaped video frame showing a polished UGC ad still of a young creator holding a beauty product. Subtle floating arrow flowing from the URL field to the phone preview. Modern dashboard with sharp typography, amber accent, deep noir background, faint product photography props around the edges. 16:9 framing.",
  },

  // ── Sprint 4 Wave 22 (2026-06-09) — NSFW preset thumbnails (Pro-safe glamour) ──
  {
    slug: "preset-boudoir-bedroom",
    prompt:
      "Magazine glamour-photography still — a young woman in elegant black sheer lace lingerie reclining on a soft pink-toned bedroom bed, satin sheets bunched around her legs, intimate window light from the side casting warm shadows. Sensual relaxed pose, hand draped above her head, magazine-glamour aesthetic, slight smile, gauzy soft-focus boudoir photography. 16:9 framing.",
  },
  {
    slug: "preset-wet-shower",
    prompt:
      "Glamour bathroom photography still — a young woman in a luxury steam-filled shower behind partially frosted glass, water cascading on her bare shoulders and upper back, glistening wet skin, hand pressed against the wet glass, head tilted back with eyes closed, intimate sensual mood, warm tungsten bathroom lighting through the steam. Magazine-quality photography, slight artistic blur. 16:9 framing.",
  },
  {
    slug: "preset-lace-lingerie",
    prompt:
      "Magazine glamour still — a young woman standing in a sultry mirror-wall bedroom wearing a black lace lingerie set, over-the-shoulder mirror pose, warm tungsten light, hand running through her hair, sensual confident expression. Glamour-magazine quality, sharp focus on her silhouette. 16:9 framing.",
  },
  {
    slug: "preset-pool-wet-look",
    prompt:
      "Vogue-style rooftop pool photography still — a young woman in a small black bikini emerging slowly from an infinity-edge pool at golden hour, water beading on glistening skin, wet hair dripping past her shoulders, sensual confident expression. Sunset golden light, luxury rooftop setting, cinematic glamour-photography aesthetic. 16:9 framing.",
  },
  {
    slug: "preset-silk-sheets",
    prompt:
      "Intimate morning bedroom photography still — a young woman waking up wrapped in white silk sheets, golden window light streaming across the bed, bare shoulders exposed, sleepy bed-tousled hair, draped sheet partially covering her body, sensual but tender mood. Magazine-quality intimate photography, soft focus. 16:9 framing.",
  },
  {
    slug: "preset-vegas-penthouse",
    prompt:
      "Glamour photography still — a young woman in a glamorous Las Vegas penthouse suite at sunset, wearing a half-open black silk robe loosely tied at the waist, standing against floor-to-ceiling windows that look out over the Vegas strip glowing pink and gold, sultry confident pose, golden cinematic light. Editorial glamour aesthetic, magazine-quality. 16:9 framing.",
  },
  {
    slug: "preset-oral",
    prompt:
      "Magazine-quality intimate close-up portrait — a young woman lying back on a softly lit luxury bedroom bed, eyes half-closed in a pleasurable expression, lips parted, head tilted back into a satin pillow, one hand resting at the edge of the frame as if reaching down. Warm tungsten bedroom lighting, sensual intimate mood, focus on her serene blissful facial expression and bare shoulders. Tasteful intimate adult photography aesthetic. 16:9 framing.",
  },

  // ── Sprint 4 Wave 17 (2026-06-09) — 6 fresh presets ──
  {
    slug: "preset-snow-globe",
    prompt:
      "Whimsical magical cinematic still — a young woman in a wool sweater standing inside a glass snow globe dome, miniaturized within the snowy winter-village scene featuring tiny gingerbread houses and pine trees. Soft white snowflakes drifting around her, warm golden lantern glow from the village, the curved glass edge of the snow globe subtly visible catching highlights. Christmas-window-display magic, vivid storybook aesthetic. 16:9 framing.",
  },
  {
    slug: "preset-tiny-person",
    prompt:
      "Whimsical tilt-shift toy-photography still — a young woman shrunk to a tiny 3-inch miniature scale standing on a wooden kitchen tabletop next to a comically oversized white ceramic coffee mug that towers above her like a building, gentle steam rising from the mug. Soft natural morning window light, shallow depth of field, viral-tiktok scale-shift composition. She's looking up at the giant mug in wide-eyed awe. 16:9 framing.",
  },
  {
    slug: "preset-disco-70s",
    prompt:
      "Vibrant 1970s disco cinematic still — a young woman in glittering gold sequin disco wear dancing on a multicolored lit-up dance floor, a glittering mirror ball above throwing spinning rainbow light spots across the room and onto her, dramatic pink and cyan strobe lights, lens flares, vintage disco-film grain. Confident hip-swaying dance pose mid-motion, joyful expression. 16:9 framing.",
  },
  {
    slug: "preset-skydiving",
    prompt:
      "Extreme-sports cinematic skydiving still — a young man in mid-freefall above a vast white cloud sea at sunrise, dramatic golden-orange sky, arms outstretched in classic belly-to-earth skydiving pose, hair and jumpsuit whipping in the wind, GoPro chest-camera-style perspective showing his exhilarated face and the curve of the earth far below. Bright red-and-orange parachute deploying behind him. 16:9 framing.",
  },
  {
    slug: "preset-crystal-cave",
    prompt:
      "Fantasy-film cinematic still — a young woman in a dark hooded explorer cloak standing in a mystical underground crystal cavern, towering glowing amethyst and quartz formations everywhere bathing the scene in ethereal violet and teal light, atmospheric particulate haze catching the magical glow, her hand reaching toward a particularly bright crystal that illuminates her face. Lord-of-the-Rings mines-of-Moria aesthetic. 16:9 framing.",
  },
  {
    slug: "preset-spy-mission",
    prompt:
      "Bond-film cinematic spy still — a young man dressed in tactical black moving stealthily through a high-tech corridor, intricate red laser security grids crisscrossing the space at multiple angles around him as he carefully ducks and weaves between them, intense focused expression, dramatic side-lit emergency lighting casting deep shadows, low-angle hero shot. Mission-impossible energy, sweat-on-brow tension. 16:9 framing.",
  },

  // ── Sprint 4 Wave 16 (2026-06-09) — AI Pet Hug ──
  {
    slug: "preset-ai-pet-hug",
    prompt:
      "Heartwarming cinematic still — a young woman with brunette hair gently embracing a golden retriever, warm golden-hour soft window light streaming behind them in a cozy modern interior, her hand stroking the dog's fur, peaceful happy expression on her face, the dog leaning into the embrace with eyes half-closed in contentment. Slow cinematic shallow depth of field, warm color grade. Tender pet-family emotional moment, pet-tok aesthetic. 16:9 framing.",
  },

  // ── Sprint 2 Wave 8 (2026-06-09) — AI Hug variants ──
  {
    slug: "preset-ai-kiss",
    prompt:
      "Romantic cinematic film still — a young couple sharing a tender slow kiss at golden-hour sunset on a hillside, soft warm backlit glow behind them, dreamy shallow depth of field, gentle wind in their hair, lens-flare highlights, both faces visible in three-quarter profile, dramatic slow camera push-in feel. Tasteful PG-13 romance-film aesthetic. 16:9 framing.",
  },
  {
    slug: "preset-ai-wedding",
    prompt:
      "Magazine-quality wedding photograph: a bride in a flowing white wedding dress and a groom in an elegant tailored navy suit embracing in a sun-drenched garden ceremony venue, white floral arrangements behind them, golden-hour cinematic light, both joyfully laughing mid-embrace, vintage film romance aesthetic. Wedding-cover magazine quality. 16:9 framing.",
  },
  {
    slug: "preset-ai-reunion",
    prompt:
      "Emotional cinematic still — a young woman and a young man running into each other's arms at an airport terminal, captured mid-embrace with joyful tears and broad smiles, soft backlit floor-to-ceiling airport-window light streaming behind them, blurred travelers and rolling suitcases in the background, slow-motion movie-trailer quality, warm cinematic color grade. 16:9 framing.",
  },

  // ── Sprint 2 Wave 7 (2026-06-09) — Talking Avatar (OmniHuman 1.5) ──
  {
    slug: "talking-avatar",
    prompt:
      "Cinematic close-up of a young professional woman mid-speech against a softly blurred warm modern interior background. Her mouth is slightly open in a natural speaking expression, eyes engaged with the viewer, subtle expressive eyebrow movement, head tilted slightly. A faint glowing translucent audio waveform graphic overlays the lower third of the frame — bold amber and white waveform lines pulsing in sync with her speech. Sharp cinematic lighting, magazine-quality realism, demonstrates AI talking avatar generation. 16:9 framing.",
  },

  // ── Sprint 1 Wave 6 (2026-06-06) — Virality Predictor ──
  {
    slug: "virality-predictor",
    prompt:
      "Cinematic UI mockup of an AI viral-score analytics dashboard. Dark moody background. Center: a giant glowing amber score number '87' in bold display typography with the label 'OVERALL VIRALITY' below it in clean white sans-serif uppercase. To the left, a row of three smaller score cards labeled 'HOOK 92', 'RETENTION 78', 'SCROLL-STOP 91'. To the right, a subtle critique text snippet in small white type. Below, three small thumbnail keyframes from a TikTok-style video preview. Modern dark dashboard aesthetic with amber accent color, sharp typography. 16:9 framing.",
  },

  // ── Sprint 1 Wave 5 (2026-06-06) — Outfit Swap ──
  {
    slug: "outfit-swap",
    prompt:
      "Cinematic three-panel composition demonstrating outfit swap. Left panel: a young woman in a plain grey hoodie standing in a clean white studio. Center panel: a flat-lay photograph of a stylish black leather jacket on a marble surface (the outfit to swap in). Right panel: the SAME woman in the EXACT same pose and studio background but now wearing the black leather jacket from the center panel — same face, same hair, same body, same pose, only the clothing changed. Thin vertical white dividers between the three panels. Subtle small labels 'YOU', 'OUTFIT', 'RESULT'. Editorial fashion photography quality. 16:9 framing.",
  },

  // ── Sprint 1 Wave 4 (2026-06-06) — Headshot Generator ──
  {
    slug: "headshot-generator",
    prompt:
      "A 2x3 grid collage thumbnail showing the same young professional woman across 6 different polished studio headshots: corporate boardroom portrait in a navy blazer (top-left), theatrical actor headshot on dark seamless backdrop with dramatic Rembrandt lighting (top-middle), warm LinkedIn-profile portrait with blurred office background (top-right), high-fashion editorial portrait in dramatic side-light (bottom-left), creative-casual lifestyle portrait in a warm modern interior (bottom-middle), athletic fitness portrait in a modern gym (bottom-right). Identical face across all 6 panels. Thin black gutters between panels. Print-magazine quality. 16:9 framing.",
  },

  // ── Sprint 1 Wave 3 (2026-06-06) — Photodump flagship ──
  {
    slug: "photodump",
    prompt:
      "A 3x4 grid collage thumbnail showing the same young woman across 12 different cinematic scenes — golden-hour portrait, editorial magazine cover, neon-lit Tokyo street at night, Paris café morning, beach at sunset, rain-soaked cyberpunk alley, snowy mountain peak at sunrise, fashion studio black backdrop, executive office portrait, tropical beach vacation, vintage 90s yearbook portrait, glamorous red carpet with paparazzi flashes. Identical face across all 12 panels. Thin black gutters between panels. Glossy editorial composition. Magazine photo-dump aesthetic. 16:9 framing.",
  },

  // ── Sprint 1 Wave 2 (2026-06-06) — preset library expansion ──
  {
    slug: "preset-kung-fu",
    prompt:
      "Cinematic action shot of a young woman mid-spin-kick — extreme dynamic pose at the apex of motion, dramatic motion blur trailing her leg, swirling dust and golden sparks on impact, low-angle hero shot, golden-hour cinematic key lighting from behind, wu-xia / shonen anime martial-arts aesthetic. Dark moody background. Action-film color grading.",
  },
  {
    slug: "preset-zombie-dance",
    prompt:
      "Stylized horror-pop video still: a young woman reimagined as a Thriller-style choreographed zombie — pale grey-green skin, tattered formal black evening dress, glowing yellow-amber eyes, mid-dance pose with arms outstretched in synchronized horror choreography. Fog-shrouded misty graveyard at night, weathered gravestones and bare gnarled trees behind her, dramatic shaft of cold moonlight from above. Cinematic Halloween viral aesthetic.",
  },
  {
    slug: "preset-dragon-fantasy",
    prompt:
      "Epic fantasy film still: a young hero in a flowing dark hooded cloak standing heroically on a windswept cliff at dawn. Behind them coils a massive ancient dragon — emerald-green scales, towering silhouette, glowing amber embers drifting from its nostrils, breath visible in the cold morning air. Misty mountain valley vista, dramatic atmospheric haze, mythic cinematic scale. Lord-of-the-Rings cinematography quality.",
  },
  {
    slug: "preset-night-vision",
    prompt:
      "Grainy military-grade night-vision surveillance still. Monochromatic green tint throughout, slight image noise and faint scanlines. A lone figure walking silently through a dark forest at night, just barely visible. Faint white reticle / HUD elements in the top-right corner reading 'NV-04  03:14:22  IR ON'. Low-light tactical aesthetic, slight handheld jitter feel, surveillance-camera POV.",
  },
  {
    slug: "preset-storm-giant",
    prompt:
      "Epic mythological cinematic painting: a colossal storm giant towering above swirling dark stormy clouds, his vast body composed of dense storm clouds and crackling blue-white lightning, electric-glowing eyes, arms outstretched commanding the heavens, torrential rain streaming around him, dramatic god-of-thunder aesthetic. Tiny silhouettes of mountains visible far below for scale. Cinematic mythic color grading, Norse/Greek pantheon energy.",
  },

  // ── Existing thumbnails (skipped if already present) ──
  {
    slug: "recraft-crisp-upscale",
    prompt:
      "Cinematic split-screen comparison thumbnail with a sharp vertical center divider. Left half: a soft, slightly blurry, lower-resolution portrait of a young woman with brown hair against a soft studio background — visible JPEG compression and softness, lower fidelity. Right half: the exact same woman in the exact same pose and lighting, but rendered in razor-sharp ultra-high-resolution detail — every eyelash, individual hair, skin pore, and fabric texture visible, pristine clarity, magazine-print sharpness. Subtle small white labels 'SOFT' on the bottom-left corner and 'CRISP' on the bottom-right corner. Tight close-up framing.",
  },
  {
    slug: "character-swap",
    prompt:
      "Cinematic split-screen before/after thumbnail with a sharp vertical center divider. Left half: a young man with short dark hair, a trimmed beard, and a charcoal sweater standing in a softly lit modern café — natural window light, shallow depth of field. Right half: the exact same scene composition, identical pose, identical lighting, identical café background — but the subject has been swapped to a young woman with long honey-blonde hair, green eyes, and a cream knit sweater. Small subtle white labels 'BEFORE' on bottom-left and 'AFTER' on bottom-right corners. Wide cinematic framing.",
  },
  {
    slug: "preset-ugc-hook",
    prompt:
      "Authentic UGC-style phone selfie of a 24-year-old woman in a sunny kitchen holding a glossy cosmetics bottle toward the camera with a genuine excited expression. Natural soft window light, slight handheld camera shake aesthetic, casual home setting visible in background, phone-camera realism (NOT cinematic), warm color grade. Composition feels like a viral TikTok product reveal.",
  },
  {
    slug: "preset-paparazzi-flash",
    prompt:
      "Vintage 2000s candid paparazzi tabloid photograph of a stylish young woman in black sunglasses and a leather jacket walking quickly through a crowd at night. Multiple bright camera flash bursts firing from the edges of the frame creating intense lens flare, heavy motion blur, grainy 35mm film aesthetic, urban street background, raw documentary energy.",
  },
  {
    slug: "preset-slow-mo",
    prompt:
      "Hyper-realistic slow-motion freeze-frame of an athletic young man mid-action — a dynamic spin kick captured at the apex of motion. 1000fps cinematic quality, extreme detail, dramatic side-lighting with a strong key light, shallow depth of field, motion-blur trails on the limbs only, fluid physics, action-movie quality. Dark moody background.",
  },
  {
    slug: "preset-magazine-cover",
    prompt:
      "Premium high-fashion editorial magazine cover photograph of a beautiful woman with sharp cheekbones and dramatic eye makeup. Dramatic studio lighting with a single key light, glossy production quality, sharp focus on the face, soft seamless dark background, Vogue-level quality, color-graded for print. Bold imaginary magazine title text 'STUDIO' across the top in clean serif type.",
  },
  {
    slug: "preset-red-carpet",
    prompt:
      "A glamorous young woman in an elegant black evening gown walking confidently on a glossy red carpet at a Hollywood film premiere. Multiple bright paparazzi camera flashes firing from both sides creating dramatic lens flares, warm golden cinematic key lighting on her face, slight motion blur on the flashes, premiere step-and-repeat backdrop visible behind her, sophisticated atmosphere. Cinematic wide framing.",
  },
  {
    slug: "preset-drift-racing",
    prompt:
      "High-energy cinematic action shot of a matte-black tuned sports car mid-drift at night on a wet city street. Thick white tire smoke billowing dramatically, neon street reflections on the wet pavement, intense motion blur, low-angle shot, action-film color grading, pink and cyan neon glows in the background, atmospheric haze.",
  },
  {
    slug: "preset-cctv",
    prompt:
      "Grainy black-and-white surveillance CCTV camera still frame. A person walking alone down an empty office hallway at night, captured from a fixed high-angle camera mount. Slight fisheye distortion visible, dim emergency lighting only, vignette in the corners, heavy tape-noise grain, white timestamp text burned into the top-right corner reading 'CAM 04 — 02:47:13'. Uncanny found-footage feel.",
  },
  {
    slug: "preset-neon-city",
    prompt:
      "A lone figure in a long coat walking slowly through a rain-soaked cyberpunk neon-lit street at night, seen from behind in a wide cinematic shot. Tall glowing pink and cyan billboards reflecting off the wet pavement, atmospheric haze, Blade Runner aesthetic, shallow depth of field, moody contemplative composition.",
  },
  {
    slug: "preset-3d-render",
    prompt:
      "Polished Pixar/Disney-style 3D character render of a friendly young woman with slightly enlarged expressive eyes, warm soft subsurface skin shading, gentle smile. Animation-studio quality, warm cinematic key light, soft bokeh background, color-graded for theatrical release.",
  },
  {
    slug: "preset-anime",
    prompt:
      "High-quality cinematic anime artwork in the style of Makoto Shinkai / Studio Trigger. A young woman in dynamic transformation pose, glowing magical energy particles swirling around her, dramatic motion lines streaking behind her, vibrant cel-shaded coloring, sparkles, expressive eyes, modern anime film aesthetic. Wide framing.",
  },
];

async function generateOne(spec: ThumbSpec): Promise<void> {
  console.log(`\n→ ${spec.slug}`);
  const start = Date.now();

  // Use Nano Banana Pro (gemini-3-pro-image-preview), 16:9 aspect
  const buf = await generateImageWithGemini(
    spec.prompt,
    undefined,
    "gemini-3-pro-image-preview",
    "16:9"
  );

  // Convert to webp at 640x360 (16:9 thumbnail size)
  const out = await sharp(buf)
    .resize(640, 360, { fit: "cover", position: "center" })
    .webp({ quality: 85 })
    .toBuffer();

  const outPath = path.join("public", "workshop-thumbs", `${spec.slug}.webp`);
  await writeFile(outPath, out);
  console.log(`  ✓ saved ${outPath} (${out.length.toLocaleString()} bytes, ${Math.round((Date.now() - start) / 1000)}s)`);
}

async function main() {
  const force = process.argv.includes("--force");
  console.log(`Generating preset thumbnails via Nano Banana Pro (Gemini)${force ? " [--force, regenerating all]" : " [skipping existing]"}...`);
  for (const spec of THUMBS) {
    const outPath = path.join("public", "workshop-thumbs", `${spec.slug}.webp`);
    if (!force && await fileExists(outPath)) {
      console.log(`\n→ ${spec.slug}  (already exists, skipping — pass --force to regenerate)`);
      continue;
    }
    try {
      await generateOne(spec);
    } catch (err) {
      console.error(`  ✗ ${spec.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
