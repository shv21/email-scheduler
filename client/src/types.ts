export interface User {
  id: string;
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailItem {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  createdAt: string;
  updatedAt?: string;
  userId?: string | null;
  job?: {
    id: string;
    delayMs: number;
    delaySeconds: number;
  };
}

export interface ComposeEmailPayload {
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  user?: User;
  errors?: Array<{ field: string; message: string }>;
}
