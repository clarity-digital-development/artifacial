"""
Direct Postgres updates for the NSFW generation worker.
Same DATABASE_URL, same tables as the Next.js Prisma schema.
Uses asyncpg for async operations within the FastAPI event loop.
"""

import os
import logging
from datetime import datetime

import asyncpg

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.environ["DATABASE_URL"],
            min_size=2,
            max_size=5,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def update_generation_processing(generation_id: str) -> None:
    """Mark a generation as PROCESSING with a start timestamp."""
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE "Generation"
        SET status = 'PROCESSING',
            progress = 10,
            "startedAt" = $2
        WHERE id = $1
        """,
        generation_id,
        datetime.utcnow(),
    )
    logger.info(f"Generation {generation_id} → PROCESSING")


async def update_generation_progress(generation_id: str, progress: int) -> None:
    """Update progress percentage (0-100)."""
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE "Generation"
        SET progress = $2
        WHERE id = $1
        """,
        generation_id,
        progress,
    )


async def update_generation_completed(
    generation_id: str,
    r2_key: str,
    duration_sec: float,
    api_cost: float,
    generation_time_ms: int,
    thumbnail_url: str | None = None,
) -> None:
    """Mark a generation as COMPLETED with the R2 key and metadata."""
    pool = await get_pool()
    now = datetime.utcnow()
    await pool.execute(
        """
        UPDATE "Generation"
        SET status = 'COMPLETED',
            progress = 100,
            "outputUrl" = $2,
            "thumbnailUrl" = $3,
            "apiCost" = $4,
            "durationSec" = $5,
            "completedAt" = $6,
            "generationTimeMs" = $7
        WHERE id = $1
        """,
        generation_id,
        r2_key,
        thumbnail_url,
        api_cost,
        duration_sec,
        now,
        generation_time_ms,
    )
    logger.info(f"Generation {generation_id} → COMPLETED (r2={r2_key}, cost=${api_cost:.4f})")


async def update_generation_failed(
    generation_id: str,
    error_message: str,
) -> None:
    """Mark a generation as FAILED."""
    pool = await get_pool()
    now = datetime.utcnow()
    await pool.execute(
        """
        UPDATE "Generation"
        SET status = 'FAILED',
            "errorMessage" = $2,
            "completedAt" = $3
        WHERE id = $1
        """,
        generation_id,
        error_message,
        now,
    )
    logger.info(f"Generation {generation_id} → FAILED: {error_message}")


async def refund_credits(
    user_id: str,
    credits_cost: int,
    generation_id: str,
    description: str = "Refund: NSFW generation failed",
) -> None:
    """
    Refund credits atomically — increment user balance and log the transaction.
    Credits go to purchasedCredits (same as the Next.js refund logic).
    """
    pool = await get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Increment purchasedCredits
            await conn.execute(
                """
                UPDATE "User"
                SET "purchasedCredits" = "purchasedCredits" + $2
                WHERE id = $1
                """,
                user_id,
                credits_cost,
            )

            # Log the refund transaction
            await conn.execute(
                """
                INSERT INTO "CreditTransaction" (id, "userId", type, credits, description, "generationId", "createdAt")
                VALUES (gen_random_uuid()::text, $1, 'refund', $2, $3, $4, NOW())
                """,
                user_id,
                credits_cost,
                description,
                generation_id,
            )

    logger.info(f"Refunded {credits_cost} credits to user {user_id} for generation {generation_id}")


async def get_generation(generation_id: str) -> dict | None:
    """Fetch a generation record."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, "userId", "workflowType", status, "contentMode", provider,
               "modelId", "inputParams", "durationSec", resolution, "creditsCost",
               "withAudio", "startedAt"
        FROM "Generation"
        WHERE id = $1
        """,
        generation_id,
    )
    return dict(row) if row else None
