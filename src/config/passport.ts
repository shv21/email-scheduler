import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma';
import '../types/auth.types';

export function configurePassport(): void {
  // Serialize user ID into session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session ID
  passport.deserializeUser(async (id: string, done) => {
    // 1. Support dev mock user for offline / test environments
    if (id.startsWith('usr_dev_mock_')) {
      return done(null, {
        id,
        googleId: 'dev_google_mock',
        email: 'alex.developer@gmail.com',
        displayName: 'Alex Developer',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 2. Lookup user in PostgreSQL
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      if (!user) {
        return done(null, null);
      }
      done(null, user);
    } catch (err) {
      console.warn(
        '⚠️ [Passport] Database unreachable during session deserialization:',
        err instanceof Error ? err.message : err
      );
      done(null, null);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn(
      '⚠️ [Passport] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in .env.'
    );
    console.warn(
      'ℹ️ [Passport] Real Google OAuth requires these credentials. Dev login is enabled at POST /api/auth/dev-login.'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          const displayName = profile.displayName || profile.name?.givenName || 'User';
          const avatarUrl = profile.photos?.[0]?.value || null;

          // Upsert user in PostgreSQL by Google ID
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
              email,
              displayName,
              avatarUrl,
            },
            create: {
              googleId: profile.id,
              email,
              displayName,
              avatarUrl,
            },
          });

          return done(null, user);
        } catch (error) {
          console.error('❌ Error during Google OAuth authentication:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );
}

export default configurePassport;
