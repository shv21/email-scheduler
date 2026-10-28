import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import emailRoutes from './routes/email.routes';
import healthRoutes from './routes/health.routes';

const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Friendly root route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Email Scheduler API',
    version: '1.0.0',
    description: 'Phase 1 minimal backend for scheduling emails',
    endpoints: {
      health: 'GET /health or GET /api/health',
      scheduleEmail: 'POST /api/emails',
    },
  });
});

// Health check endpoints (available at both root and /api)
app.use('/', healthRoutes);
app.use('/api', healthRoutes);

// Email scheduler API routes
app.use('/api', emailRoutes);

// Catch-all 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
  });
});

// Global error handling middleware (handles malformed JSON, etc.)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Check if it's a JSON parse error from express.json()
  if ('status' in err && (err as { status?: number }).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload. Please ensure request body contains valid JSON.',
    });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred',
  });
});

export default app;
