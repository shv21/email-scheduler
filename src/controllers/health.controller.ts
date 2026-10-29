import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number;
  database: 'connected' | 'disconnected';
  timestamp: string;
  environment: string;
}

export const getHealth = async (_req: Request, res: Response<HealthCheckResponse>): Promise<void> => {
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.status(200).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'email-scheduler-api',
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
};
