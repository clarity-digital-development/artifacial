"""
Diffusers inference wrapper for NSFW image generation.

Models:
  CHROMA HD:  lodestones/Chroma1-HD — Flux-based, 1-4 steps, ~12GB bf16.
              Best for stylized/fantasy. Natively uncensored.
  Juggernaut XL Ragnarok: SDXL architecture, ~8GB, DPM++ 2M Karras 25 steps.
              Best photorealism. NSFW version from CivitAI.

Model swapping: only one image model is loaded at a time.
Video pipelines (Wan2.2) are managed separately in pipeline.py.
"""

import gc
import os
import time
import logging
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Currently loaded image model
_current_model_id: str | None = None
_image_pipeline = None

# Model repos — configurable via env vars for custom weights
CHROMA_REPO = os.environ.get("CHROMA_REPO", "lodestones/Chroma1-HD")
JUGGERNAUT_REPO = os.environ.get(
    "JUGGERNAUT_REPO", "RunDiffusion/Juggernaut-XL-v9-RunDiffusionPhoto-v2"
)
JUGGERNAUT_NSFW_FILENAME = os.environ.get(
    "JUGGERNAUT_NSFW_FILENAME", "juggernautXL_ragnarokNSFW.safetensors"
)

# Known model IDs this pipeline handles
IMAGE_MODEL_IDS = {"chroma-hd", "juggernaut-xl"}

DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1024


@dataclass
class ImageGenParams:
    prompt: str
    negative_prompt: str = ""
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    num_inference_steps: int | None = None  # None = use model default
    guidance_scale: float | None = None


@dataclass
class ImageGenResult:
    output_path: Path
    width: int
    height: int
    inference_time_ms: int


def is_image_model(model_id: str) -> bool:
    """Check if this model ID should be handled by the image pipeline."""
    return model_id in IMAGE_MODEL_IDS


def is_image_model_loaded() -> bool:
    return _image_pipeline is not None


def get_current_image_model() -> str | None:
    return _current_model_id


def _teardown_image_model() -> None:
    """Full teardown of the currently loaded image model."""
    global _image_pipeline, _current_model_id

    import torch

    if _image_pipeline is None:
        return

    if hasattr(_image_pipeline, "remove_all_hooks"):
        _image_pipeline.remove_all_hooks()

    for attr in [
        "transformer", "unet", "vae", "text_encoder", "text_encoder_2",
        "tokenizer", "tokenizer_2", "image_encoder",
    ]:
        if hasattr(_image_pipeline, attr) and getattr(_image_pipeline, attr) is not None:
            delattr(_image_pipeline, attr)

    del _image_pipeline
    _image_pipeline = None
    _current_model_id = None

    gc.collect()
    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()

    logger.info("Image model teardown complete")


def _load_chroma() -> None:
    """Load CHROMA HD pipeline."""
    global _image_pipeline, _current_model_id

    import torch
    from diffusers import ChromaPipeline

    device = os.environ.get("DEVICE", "cuda")
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    hf_token = os.environ.get("HF_TOKEN")

    logger.info(f"Loading CHROMA HD: {CHROMA_REPO}")
    start = time.time()

    _image_pipeline = ChromaPipeline.from_pretrained(
        CHROMA_REPO,
        torch_dtype=dtype,
        token=hf_token,
    )

    if device == "cuda":
        _image_pipeline.enable_model_cpu_offload()

    load_time = time.time() - start
    _current_model_id = "chroma-hd"
    logger.info(f"CHROMA HD ready in {load_time:.1f}s")


def _load_juggernaut() -> None:
    """Load Juggernaut XL Ragnarok NSFW pipeline."""
    global _image_pipeline, _current_model_id

    import torch
    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler

    device = os.environ.get("DEVICE", "cuda")
    dtype = torch.float16 if device == "cuda" else torch.float32
    hf_token = os.environ.get("HF_TOKEN")

    logger.info(f"Loading Juggernaut XL Ragnarok NSFW")
    start = time.time()

    # Try from_single_file first (CivitAI checkpoint),
    # fall back to from_pretrained (HuggingFace diffusers format)
    checkpoint_path = os.environ.get("JUGGERNAUT_CHECKPOINT_PATH")

    if checkpoint_path and Path(checkpoint_path).exists():
        logger.info(f"Loading from local checkpoint: {checkpoint_path}")
        _image_pipeline = StableDiffusionXLPipeline.from_single_file(
            checkpoint_path,
            torch_dtype=dtype,
        )
    else:
        # Download from HuggingFace
        from huggingface_hub import hf_hub_download

        logger.info(f"Downloading from HuggingFace: {JUGGERNAUT_REPO}")
        local_path = hf_hub_download(
            repo_id=JUGGERNAUT_REPO,
            filename=JUGGERNAUT_NSFW_FILENAME,
            token=hf_token,
        )
        _image_pipeline = StableDiffusionXLPipeline.from_single_file(
            local_path,
            torch_dtype=dtype,
        )

    # Set DPM++ 2M Karras scheduler — recommended for Juggernaut XL
    _image_pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
        _image_pipeline.scheduler.config,
        algorithm_type="dpmsolver++",
        use_karras_sigmas=True,
    )

    if device == "cuda":
        _image_pipeline.enable_model_cpu_offload()

    load_time = time.time() - start
    _current_model_id = "juggernaut-xl"
    logger.info(f"Juggernaut XL Ragnarok ready in {load_time:.1f}s")


def ensure_image_model_loaded(model_id: str) -> None:
    """
    Load the requested image model, swapping out the current one if different.
    Uses the cache-and-swap-on-type-change pattern from OOM research.
    """
    global _current_model_id

    if _current_model_id == model_id:
        logger.info(f"Image model {model_id} already loaded")
        return

    # Teardown current model if one is loaded
    if _image_pipeline is not None:
        logger.info(f"Swapping image model: {_current_model_id} → {model_id}")
        _teardown_image_model()

    # Load the requested model
    if model_id == "chroma-hd":
        _load_chroma()
    elif model_id == "juggernaut-xl":
        _load_juggernaut()
    else:
        raise ValueError(f"Unknown image model: {model_id}")


def generate_image(model_id: str, params: ImageGenParams) -> ImageGenResult:
    """
    Generate a single image. Loads/swaps the model if needed.
    Returns path to the output image file.
    """
    if os.environ.get("SKIP_MODEL_LOAD") == "true":
        return _generate_dummy_image(params)

    import torch

    ensure_image_model_loaded(model_id)

    logger.info(
        f"Generating image with {model_id}: "
        f"{params.width}x{params.height}, "
        f"steps={params.num_inference_steps}, guidance={params.guidance_scale}"
    )

    start = time.time()

    # Resolve model-specific defaults
    if model_id == "chroma-hd":
        steps = params.num_inference_steps or 4
        guidance = params.guidance_scale or 0.0  # CHROMA uses CFG-free by default
    elif model_id == "juggernaut-xl":
        steps = params.num_inference_steps or 25
        guidance = params.guidance_scale or 6.0
    else:
        steps = params.num_inference_steps or 20
        guidance = params.guidance_scale or 7.0

    with torch.inference_mode():
        output = _image_pipeline(
            prompt=params.prompt,
            negative_prompt=params.negative_prompt or None,
            width=params.width,
            height=params.height,
            num_inference_steps=steps,
            guidance_scale=guidance,
        )

    inference_ms = int((time.time() - start) * 1000)
    logger.info(f"Image inference complete in {inference_ms}ms")

    # Save to temp file
    import tempfile
    output_path = Path(tempfile.mktemp(suffix=".webp"))
    image = output.images[0]
    image.save(str(output_path), "WEBP", quality=90)

    # Release output
    del output

    return ImageGenResult(
        output_path=output_path,
        width=params.width,
        height=params.height,
        inference_time_ms=inference_ms,
    )


def _generate_dummy_image(params: ImageGenParams) -> ImageGenResult:
    """Dummy image generation for local testing without GPU."""
    import tempfile
    from PIL import Image

    logger.info("SKIP_MODEL_LOAD: generating dummy image output")

    output_path = Path(tempfile.mktemp(suffix=".webp"))
    img = Image.new("RGB", (params.width, params.height), color=(30, 30, 30))
    img.save(str(output_path), "WEBP", quality=90)

    return ImageGenResult(
        output_path=output_path,
        width=params.width,
        height=params.height,
        inference_time_ms=50,
    )
