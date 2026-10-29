import { getSharedRedisClient } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterMs: number;
  retryAfterSeconds: number;
  shouldAlertSlack: boolean;
  windowKey: string;
}

/**
 * Returns the current UTC hour window and remaining seconds until the next hour.
 */
export function getCurrentHourWindow(): {
  windowKey: string;
  ttlSeconds: number;
  msUntilNextHour: number;
} {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const windowKey = `${year}-${month}-${day}-${hour}`;

  // Time remaining until the start of the next hour
  const minutes = now.getUTCMinutes();
  const seconds = now.getUTCSeconds();
  const ms = now.getUTCMilliseconds();
  const msElapsedInHour = (minutes * 60 + seconds) * 1000 + ms;
  // Add a small 2-second buffer so rescheduled job lands cleanly into the new hour
  const msUntilNextHour = Math.max(2000, 3600 * 1000 - msElapsedInHour + 2000);
  const ttlSeconds = Math.ceil(msUntilNextHour / 1000);

  return { windowKey, ttlSeconds, msUntilNextHour };
}

/**
 * Retrieves the configured hourly limit from environment variables (default: 1 for testing)
 */
export function getHourlyLimit(): number {
  const parsed = parseInt(process.env.HOURLY_EMAIL_LIMIT ?? '1', 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

/**
 * Evaluates per-sender hourly rate limits using Redis.
 *
 * Algorithm:
 * 1. Key: `ratelimit:sender:<sender>:<YYYY-MM-DD-HH>`
 * 2. Atomic INCR on the counter.
 * 3. On initial creation (count === 1), set key expiration for the remainder of the hour.
 * 4. If count > limit:
 *    - Revert counter increment (DECR) so counter reflects delivered/allowed volume.
 *    - Atomic SET alert key with NX: `ratelimit:alert:<sender>:<window>` EX <ttl> NX.
 *      Only the very first hit in this window returns 'OK' -> triggers Slack alert exactly ONCE.
 */
export async function checkSenderRateLimit(sender: string): Promise<RateLimitCheckResult> {
  const redis = getSharedRedisClient();
  const limit = getHourlyLimit();
  const { windowKey, ttlSeconds, msUntilNextHour } = getCurrentHourWindow();

  const counterKey = `ratelimit:sender:${sender.toLowerCase().trim()}:${windowKey}`;
  const alertKey = `ratelimit:alert:${sender.toLowerCase().trim()}:${windowKey}`;

  // 1. Increment Redis counter atomically
  const currentCount = await redis.incr(counterKey);

  // 2. Set TTL on first increment
  if (currentCount === 1) {
    await redis.expire(counterKey, ttlSeconds);
  }

  // 3. Check if hourly limit exceeded
  if (currentCount > limit) {
    // Decrement counter back down to prevent artificial accumulation
    await redis.decr(counterKey);

    // 4. Atomic check & set for Slack alert (NX flag ensures it only succeeds once per window)
    const alertSetResult = await redis.set(alertKey, '1', 'EX', ttlSeconds, 'NX');
    const shouldAlertSlack = alertSetResult === 'OK';

    return {
      allowed: false,
      currentCount: limit,
      limit,
      retryAfterMs: msUntilNextHour,
      retryAfterSeconds: Math.ceil(msUntilNextHour / 1000),
      shouldAlertSlack,
      windowKey,
    };
  }

  return {
    allowed: true,
    currentCount,
    limit,
    retryAfterMs: 0,
    retryAfterSeconds: 0,
    shouldAlertSlack: false,
    windowKey,
  };
}
