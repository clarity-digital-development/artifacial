import Redis from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return _redis;
}

export const NSFW_QUEUE = "nsfw-generation-queue";
export const POSTPROCESS_QUEUE = "postprocess-queue";
