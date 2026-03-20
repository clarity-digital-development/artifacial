# Artifacial NSFW Generation Worker

Self-hosted Wan2.2 video generation worker for NSFW content. Runs on an A100 80GB GPU instance.

## Architecture

```
Next.js app                         Python Worker (GPU)
─────────────────────────           ─────────────────────────
POST /api/generate                  main.py (FastAPI + consumer)
  → router.ts                         ↓ BRPOP from Redis
  → NSFW? lpush to Redis           pipeline.py (Wan2.2 inference)
  → return generationId               ↓
                                    storage.py (upload to R2)
GET /api/generate/[id]/status          ↓
  → reads from Postgres ←──────── database.py (update Postgres)
  → returns status + signed URL
```

Both services share: Postgres, Redis, R2. No direct communication between them.

## Environment Variables

```bash
DATABASE_URL=postgresql://...       # Same Postgres as Next.js
REDIS_URL=redis://...               # Same Redis instance
R2_ACCOUNT_ID=...                   # Same R2 credentials
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=artifacial-media
HF_TOKEN=...                        # HuggingFace token for Wan2.2 model download
DEVICE=cuda                          # cuda or cpu
SKIP_MODEL_LOAD=false                # Set to true for local dev without GPU
```

## Local Development (no GPU)

```bash
cd worker
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run with model loading skipped
SKIP_MODEL_LOAD=true uvicorn main:app --port 8000
```

Health check: `curl http://localhost:8000/health`

## GPU Deployment (Docker)

```bash
docker build -t artifacial-worker .
docker run --gpus all \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  -e R2_ACCOUNT_ID=... \
  -e R2_ACCESS_KEY_ID=... \
  -e R2_SECRET_ACCESS_KEY=... \
  -e R2_BUCKET_NAME=artifacial-media \
  -e HF_TOKEN=... \
  -p 8000:8000 \
  artifacial-worker
```

First startup downloads ~28GB of model weights. Subsequent starts use the cached weights.

## Models

- **T2V**: `Wan-AI/Wan2.2-T2V-A14B-Diffusers` — text-to-video, 14B params
- **I2V**: `Wan-AI/Wan2.2-I2V-A14B-Diffusers` — image-to-video, 14B params

Both use fp16 with `enable_model_cpu_offload()` as a safety net. On A100 80GB the full model fits in VRAM.

## Job Format

Jobs are pushed to the `nsfw-generation-queue` Redis list as JSON:

```json
{
  "generationId": "cuid-string",
  "userId": "user-id",
  "prompt": "scene description",
  "negativePrompt": "",
  "imagePath": null,
  "durationSec": 5,
  "resolution": "720p",
  "modelId": "wan2.2-t2v",
  "contentMode": "NSFW",
  "creditsCost": 1,
  "withAudio": false
}
```

## Output

- Video: H.264 MP4, CRF 18, yuv420p, 16fps
- Uploaded to R2: `users/{userId}/generations/{generationId}/output.mp4`
- DB updated: `Generation.outputUrl` = R2 key, `Generation.status` = COMPLETED
- The Next.js status endpoint generates signed URLs from the R2 key
