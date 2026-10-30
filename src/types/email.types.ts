export interface CreateEmailDTO {
  sender?: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export type EmailStatusType = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface ScheduledEmail {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date | string;
  status: EmailStatusType;
  createdAt: Date | string;
  updatedAt?: Date | string;
  userId?: string | null;
}

export interface ScheduledEmailWithJob extends ScheduledEmail {
  job?: {
    id: string;
    delayMs: number;
    delaySeconds: number;
  };
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  count?: number;
  total?: number;
  source?: 'elasticsearch' | 'database_fallback';
  warning?: string;
  query?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ValidationErrorDetail[];
}

export interface EmailDocument {
  id: string;
  userId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatusType;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSearchParams {
  q?: string;
  recipient?: string;
  subject?: string;
  status?: EmailStatusType;
  userId?: string;
  limit?: number;
  offset?: number;
}

