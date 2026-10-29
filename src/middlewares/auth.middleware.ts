import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that ensures the incoming request is authenticated via session.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  res.status(401).json({
    success: false,
    message: 'Unauthorized: You must be logged in with Google to perform this action.',
  });
};
