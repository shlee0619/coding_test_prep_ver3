/**
 * Redis store for OAuth state and token blacklist.
 * Falls back to in-memory when REDIS_URL is not configured (development).
 */
import Redis from "ioredis";
import { ENV } from "./env.js";

let redis: Redis | null = null;
let redisInitFailed = false;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (redisInitFailed) return null;
  const url = ENV.redisUrl;
  if (!url || url.trim() === "") {
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 3000)),
    });
    redis.on("error", (err) => console.warn("[Redis] Connection error:", err.message));
    redis.on("connect", () => console.log("[Redis] Connected"));
    return redis;
  } catch (err) {
    console.warn("[Redis] Failed to connect, using in-memory fallback:", err);
    redisInitFailed = true;
    return null;
  }
}

export const hasRedis = (): boolean => getRedis() !== null;

// ==================== Key prefixes ====================
const OAUTH_STATE_PREFIX = "oauth:state:";
const TOKEN_BLACKLIST_PREFIX = "auth:blacklist:";

// ==================== OAuth State Store (Redis) ====================
const STATE_TTL_SEC = 10 * 60; // 10 minutes

export async function redisOAuthStateSet(nonce: string, value: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.setex(`${OAUTH_STATE_PREFIX}${nonce}`, STATE_TTL_SEC, value);
}

export async function redisOAuthStateGet(nonce: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const val = await r.get(`${OAUTH_STATE_PREFIX}${nonce}`);
  if (val) await r.del(`${OAUTH_STATE_PREFIX}${nonce}`); // one-time use
  return val;
}

// ==================== Token Blacklist (Redis) ====================
export async function redisTokenBlacklistAdd(jti: string, expiresAtMs: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const ttlSec = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
  await r.setex(`${TOKEN_BLACKLIST_PREFIX}${jti}`, ttlSec, "1");
}

export async function redisTokenBlacklistHas(jti: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const val = await r.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
  return val === "1";
}
