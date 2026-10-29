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
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ValidationErrorDetail[];
}
