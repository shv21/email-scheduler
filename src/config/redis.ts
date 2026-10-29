import { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const getRedisConnectionOptions = (): ConnectionOptions => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const isTls = parsed.protocol === 'rediss:';

      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        tls: isTls ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch (e) {
      console.warn('⚠️ Could not parse REDIS_URL, falling back to host/port configs:', e);
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};

export const redisConnectionOptions = getRedisConnectionOptions();

/**
 * Creates an ioredis instance for checking connectivity and health
 */
export const createRedisClient = (): Redis => {
  const options = getRedisConnectionOptions();
  const client = new Redis({
    ...options,
    lazyConnect: true,
    connectTimeout: 4000,
    maxRetriesPerRequest: null,
  });

  // Attach error handler to prevent uncaught EventEmitter errors when Redis is unreachable
  client.on('error', () => {
    // Handled in calling health check
  });

  return client;
};
