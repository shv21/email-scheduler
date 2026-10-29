import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import configurePassport from './config/passport';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import healthRoutes from './routes/health.routes';

const app: Application = express();

// 1. Initialize Passport Strategies
configurePassport();

// 2. Global CORS Configuration (Supporting credentials for session cookies)
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// 3. Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 4. Secure Session Management
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'email-scheduler-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevents XSS cookie theft
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// 5. Passport Session Middleware
app.use(passport.initialize());
app.use(passport.session());

// 6. Friendly root route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Email Scheduler API',
    version: '2.0.0',
    description: 'Full-stack Email Scheduler backend with Google OAuth & BullMQ',
    endpoints: {
      health: 'GET /health',
      authGoogle: 'GET /api/auth/google',
      authMe: 'GET /api/auth/me',
      authLogout: 'POST /api/auth/logout',
      emails: 'GET /api/emails, POST /api/emails',
    },
  });
});

// 7. Route Handlers
app.use('/', healthRoutes);
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', emailRoutes);

// 8. Catch-all 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
  });
});

// 9. Global error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
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
