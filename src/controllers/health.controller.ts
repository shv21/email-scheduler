import { Request, Response } from 'express';

export interface HealthCheckResponse {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
}

export const getHealth = (_req: Request, res: Response<HealthCheckResponse>): void => {
  res.status(200).json({
    status: 'ok',
    service: 'email-scheduler-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
};
