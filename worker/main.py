"""
NSFW Generation Worker — FastAPI app + Redis consumer loop.

Runs on a GPU instance (A100 80GB). Consumes jobs from the nsfw-generation-queue
Redis list, runs Wan2.2 inference, uploads to R2, updates Postgres.

The Next.js frontend polls GET /api/generate/[id]/status which reads from the
same Postgres database — no coupling between this worker and the Next.js app
beyond shared Redis + Postgres + R2.
"""

import os
import json
import time
import asyncio
import logging
import tempfile
from pathlib import Path
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import torch
from fastapi import FastAPI

from pipeline import (
    load_models,
    generate,
    full_teardown,
    is_model_loaded,
    get_model_load_time,
    GenerationParams,
)
from image_pipeline import (
    is_image_model,
    generate_image,
    is_image_model_loaded,
    get_current_image_model,
    ImageGenParams,
)
from storage import upload_video_to_r2, upload_image_to_r2, download_from_r2
from database import (
    get_pool,
    close_pool,
    update_generation_processing,
    update_generation_progress,
    update_generation_completed,
    update_generation_failed,
    refund_credits,
)

# ─── Config ───

QUEUE_NAME = "nsfw-generation-queue"
GPU_COST_PER_SEC = 0.0012  # Estimated A100 cost: ~$4.30/hr ÷ 3600
MAX_JOBS_BEFORE_RESTART = 50  # Periodic restart for memory hygiene
MAX_CONSECUTIVE_OOMS = 3  # Force restart after N consecutive OOMs

# Job counter + OOM tracker for periodic restart
_job_count = 0
_consecutive_ooms = 0

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")


# ─── Redis ───

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            os.environ["REDIS_URL"],
            decode_responses=True,
        )
    return _redis


# ─── VRAM Management ───

def _preflight_vram_check() -> bool:
    """
    Check VRAM headroom before starting a job.
    Returns True if safe to proceed, False if VRAM is critically low.
    """
    import gc as _gc

    if not torch.cuda.is_available():
        return True

    free, total = torch.cuda.mem_get_info()
    ratio = free / total

    if ratio < 0.15:
        # Try to reclaim first
        _gc.collect()
        torch.cuda.empty_cache()
        free, total = torch.cuda.mem_get_info()
        ratio = free / total

        if ratio < 0.10:
            logger.error(
                f"VRAM critically low: {free / 1e9:.1f}GB free / {total / 1e9:.1f}GB total "
                f"({ratio:.1%}) — refusing job"
            )
            return False

    logger.info(f"VRAM pre-flight: {free / 1e9:.1f}GB free ({ratio:.1%})")
    return True


def _get_vram_health() -> dict:
    """Detailed VRAM health metrics for monitoring and leak detection."""
    if not torch.cuda.is_available():
        return {}

    stats = torch.cuda.memory_stats()
    free, total = torch.cuda.mem_get_info()

    return {
        "allocated_gb": round(stats.get("allocated_bytes.all.current", 0) / 1e9, 2),
        "reserved_gb": round(stats.get("reserved_bytes.all.current", 0) / 1e9, 2),
        "fragmentation_ratio": round(
            stats.get("inactive_split_bytes.all.current", 0)
            / max(stats.get("reserved_bytes.all.current", 0), 1),
            3,
        ),
        "alloc_retries": stats.get("num_alloc_retries", 0),
        "num_ooms": stats.get("num_ooms", 0),
        "free_vram_gb": round(free / 1e9, 2),
        "vram_utilization": round(1 - (free / total), 3),
    }


# ─── Job Processing ───

async def process_job(job_data: dict) -> None:
    """Process a single NSFW generation job with OOM recovery."""
    global _job_count, _consecutive_ooms

    generation_id = job_data["generationId"]
    user_id = job_data["userId"]

    logger.info(f"Processing job: {generation_id} for user {user_id} (job #{_job_count + 1})")
    start_time = time.time()

    # Pre-flight VRAM check
    if not _preflight_vram_check():
        await update_generation_failed(generation_id, "VRAM too low — worker restarting")
        credits_cost = int(job_data.get("creditsCost", 0))
        if credits_cost > 0:
            await refund_credits(
                user_id=user_id,
                credits_cost=credits_cost,
                generation_id=generation_id,
                description="Refund: worker VRAM too low, restarting",
            )
        raise SystemExit(42)  # Force restart with distinct exit code

    # OOM flag pattern — recovery code must be OUTSIDE except block
    # because Python exception objects hold references to stack frames
    # containing tensors, preventing garbage collection.
    oom = False
    error_msg = ""

    try:
        # Mark as PROCESSING
        await update_generation_processing(generation_id)

        model_id = job_data.get("modelId", "")
        is_image_job = is_image_model(model_id)

        if is_image_job:
            # ── Image generation (CHROMA / Juggernaut XL) ──
            img_params = ImageGenParams(
                prompt=job_data["prompt"],
                negative_prompt=job_data.get("negativePrompt", ""),
                width=_resolution_to_width(job_data.get("resolution", "1024px")),
                height=_resolution_to_height(job_data.get("resolution", "1024px")),
            )

            await update_generation_progress(generation_id, 20)

            img_result = await asyncio.get_event_loop().run_in_executor(
                None, generate_image, model_id, img_params
            )

            await update_generation_progress(generation_id, 80)

            r2_key = upload_image_to_r2(img_result.output_path, user_id, generation_id)

            inference_sec = img_result.inference_time_ms / 1000
            api_cost = inference_sec * GPU_COST_PER_SEC
            generation_time_ms = int((time.time() - start_time) * 1000)

            await update_generation_completed(
                generation_id=generation_id,
                r2_key=r2_key,
                duration_sec=0,
                api_cost=api_cost,
                generation_time_ms=generation_time_ms,
            )

            try:
                img_result.output_path.unlink()
            except OSError:
                pass

            _consecutive_ooms = 0
            _job_count += 1

            health = _get_vram_health()
            logger.info(
                f"Job {generation_id} complete: "
                f"image {img_result.width}x{img_result.height}, "
                f"model={model_id}, inference={img_result.inference_time_ms}ms, "
                f"total={generation_time_ms}ms | "
                f"VRAM: {health.get('allocated_gb', '?')}GB alloc, "
                f"frag={health.get('fragmentation_ratio', '?')}"
            )

        else:
            # ── Video generation (Wan2.2 T2V / I2V) ──
            local_image_path: str | None = None
            remote_image_url = job_data.get("imagePath")
            if remote_image_url:
                local_image_path = download_from_r2(remote_image_url, generation_id)
                logger.info(f"Downloaded source image to {local_image_path}")

            params = GenerationParams(
                prompt=job_data["prompt"],
                negative_prompt=job_data.get("negativePrompt", ""),
                image_path=local_image_path,
                duration_sec=float(job_data.get("durationSec", 5)),
                height=_resolution_to_height(job_data.get("resolution", "720p")),
                width=_resolution_to_width(job_data.get("resolution", "720p")),
            )

            await update_generation_progress(generation_id, 20)

            result = await asyncio.get_event_loop().run_in_executor(
                None, generate, params
            )

            await update_generation_progress(generation_id, 80)

            r2_key = upload_video_to_r2(result.output_path, user_id, generation_id)

            inference_sec = result.inference_time_ms / 1000
            api_cost = inference_sec * GPU_COST_PER_SEC
            generation_time_ms = int((time.time() - start_time) * 1000)

            await update_generation_completed(
                generation_id=generation_id,
                r2_key=r2_key,
                duration_sec=result.duration_sec,
                api_cost=api_cost,
                generation_time_ms=generation_time_ms,
            )

            try:
                result.output_path.unlink()
            except OSError:
                pass
            if local_image_path:
                try:
                    Path(local_image_path).unlink()
                except OSError:
                    pass

            _consecutive_ooms = 0
            _job_count += 1

            health = _get_vram_health()
            logger.info(
                f"Job {generation_id} complete: "
                f"{result.num_frames} frames, {result.duration_sec:.1f}s video, "
                f"model={model_id}, inference={result.inference_time_ms}ms, "
                f"total={generation_time_ms}ms | "
                f"VRAM: {health.get('allocated_gb', '?')}GB alloc, "
                f"frag={health.get('fragmentation_ratio', '?')}"
            )

        # Periodic restart for memory hygiene
        if _job_count >= MAX_JOBS_BEFORE_RESTART:
            logger.info(f"Reached {MAX_JOBS_BEFORE_RESTART} jobs — clean restart for memory hygiene")
            full_teardown()
            raise SystemExit(0)

        return

    except torch.cuda.OutOfMemoryError:
        oom = True
        error_msg = "CUDA out of memory"
    except SystemExit:
        raise  # Don't catch periodic restart exits
    except Exception as e:
        error_msg = str(e)[:500]
        logger.exception(f"Job {generation_id} failed: {e}")

    # ── Recovery (OUTSIDE except block to release tensor references) ──
    if oom:
        import gc as _gc

        _consecutive_ooms += 1
        logger.error(
            f"OOM on job {generation_id} "
            f"(consecutive: {_consecutive_ooms}/{MAX_CONSECUTIVE_OOMS})"
        )
        _gc.collect()
        torch.cuda.empty_cache()

        if _consecutive_ooms >= MAX_CONSECUTIVE_OOMS:
            logger.error("Max consecutive OOMs reached — forcing restart")
            full_teardown()
            raise SystemExit(1)

    # Update DB for failure (OOM or other error)
    await update_generation_failed(generation_id, error_msg)

    credits_cost = int(job_data.get("creditsCost", 0))
    if credits_cost > 0:
        await refund_credits(
            user_id=user_id,
            credits_cost=credits_cost,
            generation_id=generation_id,
            description=f"Refund: NSFW generation failed ({error_msg[:100]})",
        )


async def consumer_loop() -> None:
    """
    Main consumer loop — BRPOP from Redis, process one job at a time.
    Blocks until the current job finishes before pulling the next.
    """
    r = await get_redis()
    logger.info(f"Consumer loop started — listening on '{QUEUE_NAME}'")

    while True:
        try:
            # BRPOP blocks until a job is available (timeout=0 means block forever)
            result = await r.brpop(QUEUE_NAME, timeout=0)
            if result is None:
                continue

            _, raw_data = result
            job_data = json.loads(raw_data)

            await process_job(job_data)

        except aioredis.ConnectionError:
            logger.error("Redis connection lost — reconnecting in 5s")
            await asyncio.sleep(5)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid job JSON: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error in consumer loop: {e}")
            await asyncio.sleep(1)


# ─── FastAPI App ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: set VRAM ceiling, load model, start consumer. Shutdown: full teardown."""
    # Soft VRAM ceiling — raises catchable OOM before exhausting all VRAM
    # 10% headroom covers CUDA context, cuDNN workspace, non-PyTorch allocations
    if torch.cuda.is_available():
        torch.cuda.set_per_process_memory_fraction(0.9, device=0)
        logger.info("Set VRAM ceiling to 90% of total")

    # Start model loading in background so /health is available immediately
    model_task = asyncio.create_task(asyncio.to_thread(load_models))

    # Wait for model to load before starting consumer
    async def start_consumer():
        await model_task
        logger.info("Model loaded — starting consumer loop")
        await consumer_loop()

    consumer_task = asyncio.create_task(start_consumer())

    yield

    # Shutdown — full teardown to release all VRAM cleanly
    consumer_task.cancel()
    full_teardown()
    await close_pool()
    r = await get_redis()
    await r.close()
    logger.info("Worker shut down")


app = FastAPI(title="Artifacial NSFW Worker", lifespan=lifespan)


@app.get("/health")
async def health():
    """Health check — returns model status, GPU info, VRAM health, queue depth."""
    r = await get_redis()
    queue_depth = await r.llen(QUEUE_NAME)

    gpu_info = None
    if torch.cuda.is_available():
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "memory_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1),
            "memory_allocated_gb": round(torch.cuda.memory_allocated(0) / 1e9, 1),
            "memory_reserved_gb": round(torch.cuda.memory_reserved(0) / 1e9, 1),
        }

    return {
        "status": "ok",
        "video_model_loaded": is_model_loaded(),
        "video_model_load_time_sec": get_model_load_time(),
        "image_model_loaded": is_image_model_loaded(),
        "image_model_id": get_current_image_model(),
        "gpu": gpu_info,
        "vram_health": _get_vram_health(),
        "jobs_processed": _job_count,
        "consecutive_ooms": _consecutive_ooms,
        "max_jobs_before_restart": MAX_JOBS_BEFORE_RESTART,
        "queue_depth": queue_depth,
    }


# ─── Helpers ───

def _resolution_to_height(resolution: str) -> int:
    mapping = {"480p": 480, "720p": 720, "1080p": 1080, "1024px": 1024, "768px": 768}
    return mapping.get(resolution, 720)


def _resolution_to_width(resolution: str) -> int:
    mapping = {"480p": 854, "720p": 1280, "1080p": 1920, "1024px": 1024, "768px": 768}
    return mapping.get(resolution, 1280)
