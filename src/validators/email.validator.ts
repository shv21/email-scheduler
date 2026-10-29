import { z } from 'zod';
import { CreateEmailDTO, ValidationErrorDetail } from '../types/email.types';

export const createEmailSchema = z.object({
  sender: z
    .string()
    .trim()
    .email('sender must be a valid email address (e.g., sender@example.com)')
    .optional()
    .default(() => process.env.DEFAULT_SENDER || 'default-sender@example.com'),
  recipient: z
    .string({
      required_error: 'recipient is required',
      invalid_type_error: 'recipient must be a string',
    })
    .trim()
    .min(1, 'recipient cannot be empty')
    .email('recipient must be a valid email address (e.g., user@example.com)'),
  subject: z
    .string({
      required_error: 'subject is required',
      invalid_type_error: 'subject must be a string',
    })
    .trim()
    .min(1, 'subject cannot be empty')
    .max(255, 'subject cannot exceed 255 characters'),
  body: z
    .string({
      required_error: 'body is required',
      invalid_type_error: 'body must be a string',
    })
    .trim()
    .min(1, 'body cannot be empty'),
  scheduledAt: z
    .string({
      required_error: 'scheduledAt is required',
      invalid_type_error: 'scheduledAt must be an ISO 8601 date string',
    })
    .trim()
    .min(1, 'scheduledAt cannot be empty')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'scheduledAt must be a valid date format (e.g., 2026-10-28T18:30:00.000Z)',
    })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'scheduledAt must be a future date and time',
    }),
});

/**
 * Normalizes common variations in JSON property naming
 * e.g., scheduled_at -> scheduledAt, recipientEmail -> recipient, from -> sender
 */
export function normalizeEmailPayload(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};

  return {
    sender: raw.sender ?? raw.from ?? raw.senderEmail,
    recipient: raw.recipient ?? raw.recipientEmail ?? raw.to,
    subject: raw.subject,
    body: raw.body,
    scheduledAt: raw.scheduledAt ?? raw.scheduled_at,
  };
}

export interface ValidationResult {
  isValid: boolean;
  data?: CreateEmailDTO & { sender: string };
  errors?: ValidationErrorDetail[];
}

export function validateEmailPayload(rawPayload: Record<string, unknown>): ValidationResult {
  const normalized = normalizeEmailPayload(rawPayload);
  const result = createEmailSchema.safeParse(normalized);

  if (!result.success) {
    const errors: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'root',
      message: issue.message,
    }));

    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    data: result.data,
  };
}
