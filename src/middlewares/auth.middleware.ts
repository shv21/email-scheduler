import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that ensures the incoming request is authenticated via session.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // Provide friendly HTML unauthorized page when accessing web views in a browser
  if (req.accepts('html') && !req.path.startsWith('/api/') && !req.xhr) {
    const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.status(401).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>401 Unauthorized - BullMQ Dashboard</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 480px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
            h1 { color: #f87171; font-size: 1.5rem; margin-bottom: 0.75rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
            a.btn { display: inline-block; background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500; }
            a.btn:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🔒 401 Unauthorized</h1>
            <p>You must be authenticated via Google OAuth or active session to access the BullMQ Queue Dashboard.</p>
            <a class="btn" href="${loginUrl}">Go to Login</a>
          </div>
        </body>
      </html>
    `);
    return;
  }

  res.status(401).json({
    success: false,
    message: 'Unauthorized: You must be logged in with Google to perform this action.',
  });
};

