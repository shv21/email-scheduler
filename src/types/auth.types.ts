export interface AuthenticatedUser {
  id: string;
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    // Extend Express User with our AuthenticatedUser
    interface User extends AuthenticatedUser {}
  }
}
