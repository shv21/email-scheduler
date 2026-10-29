import { Request, Response } from 'express';
import { validateEmailPayload } from '../validators/email.validator';
import { ApiErrorResponse, ApiSuccessResponse, ScheduledEmail } from '../types/email.types';
import prisma from '../lib/prisma';

/**
 * POST /api/emails
 * Validates email scheduling payload and persists the email record to PostgreSQL via Prisma.
 */
export const createScheduledEmail = async (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmail> | ApiErrorResponse>
): Promise<void> => {
  try {
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

    // Persist record to PostgreSQL using Prisma
    const createdEmail = await prisma.email.create({
      data: {
        recipient,
        subject,
        body,
        scheduledAt: new Date(scheduledAt),
        status: 'SCHEDULED',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Email scheduled and saved to database successfully',
      data: createdEmail,
    });
  } catch (error: unknown) {
    console.error('Error saving scheduled email to PostgreSQL:', error);

    res.status(500).json({
      success: false,
      message: 'Database error: Unable to save scheduled email record',
      errors: [
        {
          field: 'database',
          message: error instanceof Error ? error.message : 'Unknown database error occurred',
        },
      ],
    });
  }
};
