import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createRedisClient } from '../config/redis';
import { checkElasticsearchHealth } from '../config/elasticsearch';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number;
  checks: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    elasticsearch: 'connected' | 'disconnected';
  };
  timestamp: string;
  environment: string;
}

export const getHealth = async (_req: Request, res: Response<HealthCheckResponse>): Promise<void> => {
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let redisStatus: 'connected' | 'disconnected' = 'disconnected';
  let esStatus: 'connected' | 'disconnected' = 'disconnected';

  // 1. Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  // 2. Check Redis
  const redis = createRedisClient();
  try {
    await redis.connect();
    await redis.ping();
    redisStatus = 'connected';
  } catch {
    redisStatus = 'disconnected';
  } finally {
    try {
      redis.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }

  // 3. Check Elasticsearch (non-blocking)
  try {
    const isEsAlive = await checkElasticsearchHealth();
    esStatus = isEsAlive ? 'connected' : 'disconnected';
  } catch {
    esStatus = 'disconnected';
  }

  const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

  res.status(200).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'email-scheduler-api',
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      database: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
};

