import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * GET /api/auth/me
 * Returns profile details of the currently authenticated user
 */
export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authenticated',
      user: null,
    });
    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      googleId: req.user.googleId,
      email: req.user.email,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
    },
  });
};

/**
 * POST /api/auth/logout
 * Destroys user session and clears the session cookie
 */
export const logout = (req: Request, res: Response): void => {
  req.logout((err) => {
    if (err) {
      console.error('Error logging out:', err);
      res.status(500).json({ success: false, message: 'Failed to log out' });
      return;
    }

    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        console.error('Error destroying session:', sessionErr);
      }
      res.clearCookie('connect.sid');
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
};

/**
 * POST /api/auth/dev-login
 * Development helper: Allows testing the dashboard & protected routes
 * without configuring live Google Cloud Console credentials.
 */
export const devLogin = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ success: false, message: 'Dev login is disabled in production' });
    return;
  }

  const email = req.body?.email || 'alex.developer@gmail.com';
  const displayName = req.body?.displayName || 'Alex Developer';
  const avatarUrl =
    req.body?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  const googleId = req.body?.googleId || `dev_google_${Buffer.from(email).toString('hex').slice(0, 12)}`;

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName, avatarUrl },
      create: {
        googleId,
        email,
        displayName,
        avatarUrl,
      },
    });

    req.login(user, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: 'Login session failed', error: err.message });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Dev login successful',
        user: {
          id: user.id,
          googleId: user.googleId,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      });
    });
  } catch (dbErr: unknown) {
    // Fallback in-memory user if DB is unreachable during testing
    const fallbackUser = {
      id: 'usr_dev_mock_12345',
      googleId,
      email,
      displayName,
      avatarUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    req.login(fallbackUser, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: 'Login session failed' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Dev login successful (in-memory test session)',
        user: fallbackUser,
      });
    });
  }
};
