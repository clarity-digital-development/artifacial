"""
R2 upload module — same bucket, same key structure as the Next.js app.
Uses boto3 with S3-compatible endpoint for Cloudflare R2.
"""

import os
import logging
from pathlib import Path

import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        account_id = os.environ["R2_ACCOUNT_ID"]
        _s3_client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
    return _s3_client


def get_bucket_name() -> str:
    return os.environ.get("R2_BUCKET_NAME", "artifacial-media")


def r2_key_for_generation(user_id: str, generation_id: str, ext: str = "mp4") -> str:
    """Same key structure as the Next.js status endpoint."""
    return f"users/{user_id}/generations/{generation_id}/output.{ext}"


def download_from_r2(r2_url_or_key: str, generation_id: str) -> str:
    """
    Download a file from R2 to a local temp file.
    Accepts either an R2 key (users/xxx/...) or a full R2 URL.
    Returns the local file path.
    """
    import tempfile
    from urllib.parse import urlparse

    # Extract key from URL if needed
    if r2_url_or_key.startswith("http"):
        parsed = urlparse(r2_url_or_key)
        # R2 URLs: https://<bucket>.<account>.r2.cloudflarestorage.com/<key>
        key = parsed.path.lstrip("/")
    else:
        key = r2_url_or_key

    # Determine extension from key
    ext = Path(key).suffix or ".png"
    local_path = Path(tempfile.mktemp(suffix=ext, prefix=f"nsfw-input-{generation_id}-"))

    bucket = get_bucket_name()
    logger.info(f"Downloading from R2: {bucket}/{key} → {local_path}")

    get_s3_client().download_file(bucket, key, str(local_path))

    file_size_mb = local_path.stat().st_size / 1024 / 1024
    logger.info(f"Download complete: {local_path} ({file_size_mb:.1f} MB)")

    return str(local_path)


def upload_video_to_r2(
    local_path: Path,
    user_id: str,
    generation_id: str,
) -> str:
    """
    Upload a local video file to R2.
    Returns the R2 key (not a URL — the Next.js app generates signed URLs from the key).
    """
    ext = local_path.suffix.lstrip(".")
    key = r2_key_for_generation(user_id, generation_id, ext)
    bucket = get_bucket_name()

    content_type = "video/mp4" if ext == "mp4" else f"video/{ext}"

    logger.info(f"Uploading {local_path} to R2: {bucket}/{key}")

    get_s3_client().upload_file(
        str(local_path),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )

    logger.info(f"Upload complete: {key} ({local_path.stat().st_size / 1024 / 1024:.1f} MB)")
    return key


def upload_image_to_r2(
    local_path: Path,
    user_id: str,
    generation_id: str,
) -> str:
    """
    Upload a local image file to R2.
    Returns the R2 key.
    """
    ext = local_path.suffix.lstrip(".")
    key = r2_key_for_generation(user_id, generation_id, ext)
    bucket = get_bucket_name()

    content_type_map = {
        "webp": "image/webp",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    content_type = content_type_map.get(ext, f"image/{ext}")

    logger.info(f"Uploading {local_path} to R2: {bucket}/{key}")

    get_s3_client().upload_file(
        str(local_path),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )

    logger.info(f"Upload complete: {key} ({local_path.stat().st_size / 1024 / 1024:.2f} MB)")
    return key
