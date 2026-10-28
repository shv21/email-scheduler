import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { validateEmailPayload } from '../validators/email.validator';
import { ApiErrorResponse, ApiSuccessResponse, ScheduledEmail } from '../types/email.types';

/**
 * POST /api/emails
 * Validates email scheduling payload and returns a confirmed scheduled email object.
 * Note: Database persistence and job queues (BullMQ/Redis) will be introduced in subsequent phases.
 */
export const createScheduledEmail = (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmail> | ApiErrorResponse>
): void => {
  const validation = validateEmailPayload(req.body);

  if (!validation.isValid || !validation.data) {
    res.status(400).json({
      success: false,
      message: 'Validation failed: Please ensure all required fields are correctly formatted.',
      errors: validation.errors ?? [],
    });
    return;
  }

  const { recipient, subject, body, scheduledAt } = validation.data;

  // In Phase 1: Create in-memory mock record
  const scheduledEmail: ScheduledEmail = {
    id: `email_${randomUUID()}`,
    recipient,
    subject,
    body,
    scheduledAt,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };

  res.status(201).json({
    success: true,
    message: 'Email scheduled successfully',
    data: scheduledEmail,
  });
};
