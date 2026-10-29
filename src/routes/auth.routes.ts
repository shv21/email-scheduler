import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { getCurrentUser, logout, devLogin } from '../controllers/auth.controller';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Initiate Google OAuth Flow
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      success: false,
      message:
        'Google OAuth credentials not configured in .env. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use POST /api/auth/dev-login for local testing.',
    });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// 2. Google OAuth Callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${CLIENT_URL}/?error=auth_failed`,
  }),
  (_req: Request, res: Response) => {
    // Successful login: Redirect to frontend React dashboard
    res.redirect(`${CLIENT_URL}/`);
  }
);

// 3. Current Authenticated User Profile
router.get('/me', getCurrentUser);

// 4. Logout Session
router.post('/logout', logout);

// 5. Development Mode Quick Login
router.post('/dev-login', devLogin);

export default router;
