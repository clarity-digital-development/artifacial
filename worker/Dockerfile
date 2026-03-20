FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# OOM prevention: expandable_segments alone cuts peak VRAM ~34%
ENV PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True,garbage_collection_threshold:0.8,roundup_power2_divisions:4"

# Install ffmpeg and system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker code
COPY . .

# Expose health check port
EXPOSE 8000

# Run the worker with restart loop for memory hygiene
# Worker exits cleanly after ~50 jobs or on consecutive OOMs;
# the loop restarts it with a fresh CUDA context.
CMD ["bash", "-c", "while true; do uvicorn main:app --host 0.0.0.0 --port 8000; echo 'Worker exited ($?) — restarting in 2s'; sleep 2; done"]
