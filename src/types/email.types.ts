export interface CreateEmailDTO {
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'failed';
  createdAt: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ValidationErrorDetail[];
}
