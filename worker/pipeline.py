"""
Diffusers inference wrapper for Wan2.2 NSFW video generation.

Models:
  T2V: Base scaffolding from Wan-AI/Wan2.2-T2V-A14B-Diffusers,
       NSFW low-noise transformer from FX-FeiHou/wan2.2-Remix.
       High-noise expert stays base (NSFW T2V high-noise requires Lightning fp8).
  I2V: Base scaffolding from Wan-AI/Wan2.2-I2V-A14B-Diffusers,
       NSFW dual-transformers from FX-FeiHou/wan2.2-Remix (high/low noise stages).

All NSFW weights from: https://huggingface.co/FX-FeiHou/wan2.2-Remix (NSFW/ subfolder)
Requires: A100 80GB with CUDA, ffmpeg installed.

Architecture: Lazy loading — only one pipeline (T2V or I2V) is held in memory at a time.
When a job arrives for the other pipeline type, the current one is fully torn down first.
This keeps peak CPU RAM under 90GB (fits Thunder Compute's 12 vCPU / 96GB tier).
"""

import gc
import os
import time
import logging
import subprocess
import tempfile
from pathlib import Path
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)

# Currently loaded pipeline — only ONE at a time to stay within 90GB RAM
_active_pipeline = None  # The actual Diffusers pipeline object
_active_type: str | None = None  # "t2v" or "i2v"
_model_loaded = False
_model_load_time: float | None = None

# Base Diffusers pipelines (VAE, scheduler, text encoder, tokenizer)
T2V_BASE_ID = "Wan-AI/Wan2.2-T2V-A14B-Diffusers"
I2V_BASE_ID = "Wan-AI/Wan2.2-I2V-A14B-Diffusers"

# All NSFW transformer weights live in FX-FeiHou/wan2.2-Remix under NSFW/ subfolder
NSFW_REPO = "FX-FeiHou/wan2.2-Remix"
NSFW_SUBFOLDER = "NSFW"

# T2V: only low-noise expert has an NSFW version; high-noise stays base
T2V_NSFW_LOW_NOISE = "Wan2.2_Remix_NSFW_t2v_14b_low_lighting_v2.0.safetensors"

# I2V: both high-noise and low-noise have NSFW versions
I2V_NSFW_HIGH_NOISE = "Wan2.2_Remix_NSFW_i2v_14b_high_lighting_v2.0.safetensors"
I2V_NSFW_LOW_NOISE = "Wan2.2_Remix_NSFW_i2v_14b_low_lighting_v2.0.safetensors"

FPS = 16
DEFAULT_STEPS = 24
DEFAULT_GUIDANCE = 5.0
DEFAULT_HEIGHT = 720
DEFAULT_WIDTH = 1280


@dataclass
class GenerationParams:
    prompt: str
    negative_prompt: str = ""
    image_path: str | None = None  # For I2V — local file path
    duration_sec: float = 5.0
    height: int = DEFAULT_HEIGHT
    width: int = DEFAULT_WIDTH
    num_inference_steps: int = DEFAULT_STEPS
    guidance_scale: float = DEFAULT_GUIDANCE


@dataclass
class GenerationResult:
    output_path: Path
    duration_sec: float
    num_frames: int
    inference_time_ms: int


def is_model_loaded() -> bool:
    return _model_loaded


def get_model_load_time() -> float | None:
    return _model_load_time


def get_active_pipeline_type() -> str | None:
    return _active_type


def full_teardown() -> None:
    """
    Full VRAM + RAM teardown — call before process exit or model reload.
    Removes Accelerate hooks first (breaks reference chains), then deletes
    individual components, forces GC, and clears CUDA cache.
    """
    global _active_pipeline, _active_type, _model_loaded

    import torch

    if _active_pipeline is not None:
        # 1. Remove Accelerate hooks FIRST (breaks reference chains)
        if hasattr(_active_pipeline, "remove_all_hooks"):
            _active_pipeline.remove_all_hooks()
        # 2. Delete individual components to break circular references
        for attr in [
            "transformer", "transformer_2", "unet", "vae",
            "text_encoder", "text_encoder_2", "text_encoder_3",
            "tokenizer", "tokenizer_2", "image_encoder",
        ]:
            if hasattr(_active_pipeline, attr) and getattr(_active_pipeline, attr) is not None:
                delattr(_active_pipeline, attr)

    # 3. Delete pipeline object
    _active_pipeline = None
    _active_type = None
    _model_loaded = False

    # 4. Force Python GC BEFORE clearing CUDA cache (second pass catches cycles)
    gc.collect()
    gc.collect()

    # 5. Release CUDA cached memory
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()

    logger.info("Full VRAM teardown complete")


def _download_single_file(
    repo_id: str, filename: str, token: str | None, subfolder: str | None = None
) -> str:
    """Download a single file from HuggingFace Hub and return its local path."""
    from huggingface_hub import hf_hub_download

    kwargs: dict = {"repo_id": repo_id, "filename": filename, "token": token}
    if subfolder:
        kwargs["subfolder"] = subfolder
    return hf_hub_download(**kwargs)


def load_models() -> None:
    """
    Pre-download all model weights so first job doesn't wait for downloads.
    Does NOT load into RAM/VRAM — lazy loading handles that per-job.
    """
    global _model_loaded, _model_load_time

    if os.environ.get("SKIP_MODEL_LOAD") == "true":
        logger.warning("SKIP_MODEL_LOAD=true — skipping model pre-download")
        _model_loaded = True
        _model_load_time = 0.0
        return

    hf_token = os.environ.get("HF_TOKEN")
    start = time.time()

    # Pre-download NSFW transformer weights (cached by huggingface_hub)
    logger.info("Pre-downloading NSFW transformer weights...")
    for filename in [T2V_NSFW_LOW_NOISE, I2V_NSFW_HIGH_NOISE, I2V_NSFW_LOW_NOISE]:
        logger.info(f"  Ensuring cached: {NSFW_REPO}/{NSFW_SUBFOLDER}/{filename}")
        _download_single_file(NSFW_REPO, filename, hf_token, subfolder=NSFW_SUBFOLDER)

    _model_load_time = time.time() - start
    _model_loaded = True
    logger.info(f"Model pre-download complete in {_model_load_time:.1f}s — ready for lazy loading")


def _teardown_active_pipeline() -> None:
    """Tear down the currently loaded pipeline to free RAM/VRAM for a different one."""
    global _active_pipeline, _active_type

    import torch

    if _active_pipeline is None:
        return

    logger.info(f"Tearing down active {_active_type} pipeline to free memory")

    if hasattr(_active_pipeline, "remove_all_hooks"):
        _active_pipeline.remove_all_hooks()

    for attr in [
        "transformer", "transformer_2", "unet", "vae",
        "text_encoder", "text_encoder_2", "text_encoder_3",
        "tokenizer", "tokenizer_2", "image_encoder",
    ]:
        if hasattr(_active_pipeline, attr) and getattr(_active_pipeline, attr) is not None:
            delattr(_active_pipeline, attr)

    _active_pipeline = None
    _active_type = None

    gc.collect()
    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    logger.info("Active pipeline teardown complete")


def _ensure_t2v() -> None:
    """Lazy-load T2V pipeline. Tears down I2V first if loaded."""
    global _active_pipeline, _active_type

    if _active_type == "t2v" and _active_pipeline is not None:
        return  # Already loaded

    import torch
    from diffusers import WanPipeline, WanTransformer3DModel

    _teardown_active_pipeline()

    device = os.environ.get("DEVICE", "cuda")
    dtype = torch.float16 if device == "cuda" else torch.float32
    hf_token = os.environ.get("HF_TOKEN")

    start = time.time()

    logger.info(f"Lazy-loading T2V base pipeline: {T2V_BASE_ID}")
    _active_pipeline = WanPipeline.from_pretrained(
        T2V_BASE_ID,
        torch_dtype=dtype,
        token=hf_token,
        low_cpu_mem_usage=True,
    )

    # Delete low-noise transformer before loading NSFW replacement
    if hasattr(_active_pipeline, "transformer_2") and _active_pipeline.transformer_2 is not None:
        del _active_pipeline.transformer_2
        gc.collect()

    logger.info(f"Swapping T2V NSFW low-noise transformer: {T2V_NSFW_LOW_NOISE}")
    t2v_nsfw_path = _download_single_file(NSFW_REPO, T2V_NSFW_LOW_NOISE, hf_token, subfolder=NSFW_SUBFOLDER)
    t2v_nsfw_transformer = WanTransformer3DModel.from_single_file(
        t2v_nsfw_path,
        torch_dtype=dtype,
    )
    _active_pipeline.transformer_2 = t2v_nsfw_transformer

    if device == "cuda":
        _active_pipeline.enable_model_cpu_offload()

    _active_type = "t2v"
    logger.info(f"T2V NSFW pipeline ready in {time.time() - start:.1f}s")


def _ensure_i2v() -> None:
    """Lazy-load I2V pipeline. Tears down T2V first if loaded."""
    global _active_pipeline, _active_type

    if _active_type == "i2v" and _active_pipeline is not None:
        return  # Already loaded

    import torch
    from diffusers import WanImageToVideoPipeline, WanTransformer3DModel

    _teardown_active_pipeline()

    device = os.environ.get("DEVICE", "cuda")
    dtype = torch.float16 if device == "cuda" else torch.float32
    hf_token = os.environ.get("HF_TOKEN")

    start = time.time()

    logger.info(f"Lazy-loading I2V base pipeline: {I2V_BASE_ID}")
    _active_pipeline = WanImageToVideoPipeline.from_pretrained(
        I2V_BASE_ID,
        torch_dtype=dtype,
        token=hf_token,
        low_cpu_mem_usage=True,
    )

    # Delete both base transformers before loading NSFW replacements
    del _active_pipeline.transformer
    if hasattr(_active_pipeline, "transformer_2"):
        del _active_pipeline.transformer_2
    gc.collect()

    logger.info(f"Swapping I2V NSFW high-noise transformer: {I2V_NSFW_HIGH_NOISE}")
    i2v_high_path = _download_single_file(NSFW_REPO, I2V_NSFW_HIGH_NOISE, hf_token, subfolder=NSFW_SUBFOLDER)
    i2v_high_transformer = WanTransformer3DModel.from_single_file(
        i2v_high_path,
        torch_dtype=dtype,
    )
    _active_pipeline.transformer = i2v_high_transformer

    gc.collect()

    logger.info(f"Swapping I2V NSFW low-noise transformer: {I2V_NSFW_LOW_NOISE}")
    i2v_low_path = _download_single_file(NSFW_REPO, I2V_NSFW_LOW_NOISE, hf_token, subfolder=NSFW_SUBFOLDER)
    i2v_low_transformer = WanTransformer3DModel.from_single_file(
        i2v_low_path,
        torch_dtype=dtype,
    )
    _active_pipeline.transformer_2 = i2v_low_transformer

    # Workaround: from_single_file misidentifies Wan2.2 as Wan2.1
    # See: https://github.com/huggingface/diffusers/issues/12329
    _active_pipeline.transformer.config.image_dim = None
    _active_pipeline.transformer_2.config.image_dim = None

    if device == "cuda":
        _active_pipeline.enable_model_cpu_offload()

    _active_type = "i2v"
    logger.info(f"I2V NSFW pipeline ready in {time.time() - start:.1f}s")


def generate(params: GenerationParams) -> GenerationResult:
    """
    Run inference and return the path to the output MP4.
    Blocks until complete — call from the sync worker loop.
    """
    if not _model_loaded:
        raise RuntimeError("Models not loaded. Call load_models() first.")

    if os.environ.get("SKIP_MODEL_LOAD") == "true":
        return _generate_dummy(params)

    import torch
    from PIL import Image

    num_frames = int(params.duration_sec * FPS)
    is_i2v = params.image_path is not None

    # Lazy-load the right pipeline (tears down the other if needed)
    if is_i2v:
        _ensure_i2v()
    else:
        _ensure_t2v()

    logger.info(
        f"Generating {'I2V' if is_i2v else 'T2V'}: "
        f"{num_frames} frames @ {params.width}x{params.height}, "
        f"steps={params.num_inference_steps}, guidance={params.guidance_scale}"
    )

    start = time.time()

    # inference_mode > no_grad: disables view tracking + version counters (~12% speed gain)
    with torch.inference_mode():
        if is_i2v:
            image = Image.open(params.image_path).convert("RGB")
            image = image.resize((params.width, params.height))

            output = _active_pipeline(
                prompt=params.prompt,
                negative_prompt=params.negative_prompt or None,
                image=image,
                num_frames=num_frames,
                height=params.height,
                width=params.width,
                num_inference_steps=params.num_inference_steps,
                guidance_scale=params.guidance_scale,
            )
        else:
            output = _active_pipeline(
                prompt=params.prompt,
                negative_prompt=params.negative_prompt or None,
                num_frames=num_frames,
                height=params.height,
                width=params.width,
                num_inference_steps=params.num_inference_steps,
                guidance_scale=params.guidance_scale,
            )

    inference_ms = int((time.time() - start) * 1000)
    logger.info(f"Inference complete in {inference_ms}ms")

    # Move frames off GPU immediately — output.frames[0] stays on GPU by default
    frames = output.frames[0]
    del output

    # Encode frames to MP4 via ffmpeg
    output_path = _frames_to_mp4(frames, FPS)

    return GenerationResult(
        output_path=output_path,
        duration_sec=len(frames) / FPS,
        num_frames=len(frames),
        inference_time_ms=inference_ms,
    )


def _generate_dummy(params: GenerationParams) -> GenerationResult:
    """Dummy generation for local testing without GPU."""
    logger.info("SKIP_MODEL_LOAD: generating dummy output")
    num_frames = int(params.duration_sec * FPS)

    # Create a tiny dummy MP4 with ffmpeg
    output_path = Path(tempfile.mktemp(suffix=".mp4"))
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=c=black:s=320x240:d={params.duration_sec}:r={FPS}",
            "-vf", f"drawtext=text='NSFW Worker Test':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "23",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )

    return GenerationResult(
        output_path=output_path,
        duration_sec=params.duration_sec,
        num_frames=num_frames,
        inference_time_ms=100,
    )


def _frames_to_mp4(frames: list, fps: int) -> Path:
    """Encode a list of PIL Image frames to H.264 MP4 using ffmpeg."""
    output_path = Path(tempfile.mktemp(suffix=".mp4"))
    frame_dir = Path(tempfile.mkdtemp())

    try:
        # Write frames as PNGs
        for i, frame in enumerate(frames):
            frame_path = frame_dir / f"frame_{i:05d}.png"
            frame.save(str(frame_path))

        # Encode with ffmpeg
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", str(frame_dir / "frame_%05d.png"),
            "-c:v", "libx264",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-movflags", "+faststart",
            str(output_path),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"ffmpeg error: {result.stderr}")
            raise RuntimeError(f"ffmpeg encoding failed: {result.stderr[:500]}")

        file_size_mb = output_path.stat().st_size / 1024 / 1024
        logger.info(f"Encoded {len(frames)} frames → {output_path} ({file_size_mb:.1f} MB)")

        return output_path

    finally:
        # Clean up frame PNGs
        import shutil
        shutil.rmtree(frame_dir, ignore_errors=True)
