import { Request, Response } from 'express';
import { validateEmailPayload } from '../validators/email.validator';
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  ScheduledEmailWithJob,
} from '../types/email.types';
import prisma from '../lib/prisma';
import { addEmailToQueue } from '../queues/email.queue';

/**
 * POST /api/emails
 * 1. Validates input payload (including optional/normalized sender)
 * 2. Saves record to PostgreSQL (status: SCHEDULED)
 * 3. Enqueues delayed job to Redis via BullMQ
 */
export const createScheduledEmail = async (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmailWithJob> | ApiErrorResponse>
): Promise<void> => {
  try {
    // 1. Validation
    const validation = validateEmailPayload(req.body);

    if (!validation.isValid || !validation.data) {
      res.status(400).json({
        success: false,
        message: 'Validation failed: Please ensure all required fields are correctly formatted.',
        errors: validation.errors ?? [],
      });
      return;
    }

    const { sender, recipient, subject, body, scheduledAt } = validation.data;

    // 2. Persist record to PostgreSQL
    let createdEmail;
    try {
      createdEmail = await prisma.email.create({
        data: {
          sender,
          recipient,
          subject,
          body,
          scheduledAt: new Date(scheduledAt),
          status: 'SCHEDULED',
        },
      });
    } catch (dbError: unknown) {
      console.error('❌ Database insertion failed:', dbError);
      res.status(500).json({
        success: false,
        message: 'Database error: Unable to save email to PostgreSQL',
        errors: [
          {
            field: 'database',
            message: dbError instanceof Error ? dbError.message : 'Failed to connect to PostgreSQL',
          },
        ],
      });
      return;
    }

    // 3. Calculate delay in milliseconds
    const targetTime = new Date(scheduledAt).getTime();
    const delayMs = Math.max(0, targetTime - Date.now());

    // 4. Enqueue into Redis via BullMQ
    let job;
    try {
      job = await addEmailToQueue(
        {
          emailId: createdEmail.id,
          sender: createdEmail.sender,
          recipient: createdEmail.recipient,
          subject: createdEmail.subject,
          body: createdEmail.body,
          scheduledAt: createdEmail.scheduledAt.toISOString(),
        },
        delayMs
      );
    } catch (queueError: unknown) {
      console.error('❌ Redis queue insertion failed:', queueError);
      res.status(502).json({
        success: false,
        message:
          'Email saved to PostgreSQL, but failed to enqueue delayed job in Redis. Please ensure Redis is running.',
        errors: [
          {
            field: 'redis',
            message: queueError instanceof Error ? queueError.message : 'Redis connection error',
          },
        ],
      });
      return;
    }

    // 5. Successful Response
    res.status(201).json({
      success: true,
      message: 'Email scheduled, persisted in PostgreSQL, and enqueued in Redis BullMQ queue',
      data: {
        id: createdEmail.id,
        sender: createdEmail.sender,
        recipient: createdEmail.recipient,
        subject: createdEmail.subject,
        body: createdEmail.body,
        scheduledAt: createdEmail.scheduledAt,
        status: createdEmail.status,
        createdAt: createdEmail.createdAt,
        updatedAt: createdEmail.updatedAt,
        job: {
          id: String(job.id),
          delayMs,
          delaySeconds: Math.round(delayMs / 1000),
        },
      },
    });
  } catch (error: unknown) {
    console.error('❌ Unexpected error in createScheduledEmail:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected internal error occurred',
      errors: [
        {
          field: 'server',
          message: error instanceof Error ? error.message : 'Unknown server error',
        },
      ],
    });
  }
};
