import { Request, Response } from 'express';
import { validateEmailPayload } from '../validators/email.validator';
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  ScheduledEmail,
  ScheduledEmailWithJob,
  EmailStatusType,
} from '../types/email.types';
import prisma from '../lib/prisma';
import { addEmailToQueue } from '../queues/email.queue';
import {
  indexEmailDocument,
  searchEmailsInIndex,
} from '../services/elasticsearch.service';

/**
 * POST /api/emails
 * 1. Validates input payload
 * 2. Associates with authenticated user if present
 * 3. Saves record to PostgreSQL (status: SCHEDULED)
 * 4. Enqueues delayed job to Redis via BullMQ
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

    const { recipient, subject, body, scheduledAt } = validation.data;

    // Use logged in user's email as sender if authenticated, otherwise use body sender
    const userId = req.user?.id || null;
    const effectiveSender = req.user?.email || validation.data.sender;

    // 2. Persist record to PostgreSQL
    let createdEmail;
    try {
      createdEmail = await prisma.email.create({
        data: {
          sender: effectiveSender,
          recipient,
          subject,
          body,
          scheduledAt: new Date(scheduledAt),
          status: 'SCHEDULED',
          userId,
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

    // 2b. Asynchronously index email in Elasticsearch (PostgreSQL remains primary source of truth)
    indexEmailDocument({
      id: createdEmail.id,
      sender: createdEmail.sender,
      recipient: createdEmail.recipient,
      subject: createdEmail.subject,
      body: createdEmail.body,
      scheduledAt: createdEmail.scheduledAt,
      status: createdEmail.status,
      createdAt: createdEmail.createdAt,
      updatedAt: createdEmail.updatedAt,
      userId: createdEmail.userId,
    }).catch((esErr) => {
      console.warn('⚠️ [Elasticsearch] Background index error:', esErr);
    });

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
        userId: createdEmail.userId,
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

/**
 * GET /api/emails
 * Lists emails belonging to the authenticated user.
 * Supports optional ?status=SCHEDULED | SENT | PROCESSING | FAILED query param.
 */
export const getUserEmails = async (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmail[]> | ApiErrorResponse>
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const statusQuery = req.query.status as EmailStatusType | undefined;

    const whereClause: {
      userId?: string;
      status?: EmailStatusType;
    } = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (statusQuery) {
      whereClause.status = statusQuery;
    }

    try {
      const emails = await prisma.email.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        count: emails.length,
        data: emails,
      });
    } catch (dbErr: unknown) {
      console.warn('⚠️ Could not query database for user emails:', dbErr);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve emails from database',
        errors: [
          {
            field: 'database',
            message: dbErr instanceof Error ? dbErr.message : 'Database error',
          },
        ],
      });
    }
  } catch (error: unknown) {
    console.error('❌ Unexpected error in getUserEmails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user emails',
    });
  }
};

/**
 * GET /api/emails/:id
 * Fetches a single email by ID, ensuring ownership by the authenticated user.
 */
export const getEmailById = async (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmail> | ApiErrorResponse>
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const email = await prisma.email.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
    });

    if (!email) {
      res.status(404).json({
        success: false,
        message: 'Email not found or you do not have permission to view it',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: email,
    });
  } catch (err: unknown) {
    console.error('❌ Error in getEmailById:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email record',
    });
  }
};

/**
 * GET /api/emails/search
 * Protected search endpoint leveraging Elasticsearch.
 * Supports searching by recipient email, subject, status, or free-text query (q).
 * Scoped to authenticated user's ID for tenant isolation.
 * Gracefully falls back to PostgreSQL if Elasticsearch is temporarily unavailable.
 */
export const searchEmails = async (
  req: Request,
  res: Response<ApiSuccessResponse<ScheduledEmail[]> | ApiErrorResponse>
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const recipient = req.query.recipient as string | undefined;
    const subject = req.query.subject as string | undefined;
    const status = req.query.status as EmailStatusType | undefined;
    const q = req.query.q as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const validStatuses: EmailStatusType[] = ['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status parameter. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    try {
      // 1. Primary: Elasticsearch Search
      const searchResult = await searchEmailsInIndex({
        userId,
        recipient,
        subject,
        status,
        q,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: searchResult.emails,
        total: searchResult.total,
        count: searchResult.emails.length,
        source: 'elasticsearch',
        query: { recipient, subject, status, q },
      });
      return;
    } catch (esError) {
      console.warn(
        '⚠️ [Elasticsearch] Search query failed, gracefully falling back to PostgreSQL source of truth:',
        esError instanceof Error ? esError.message : esError
      );

      // 2. Fallback: PostgreSQL Source of Truth
      const whereClause: {
        userId?: string;
        status?: EmailStatusType;
        recipient?: { contains: string; mode?: 'insensitive' };
        subject?: { contains: string; mode?: 'insensitive' };
        OR?: Array<
          | { subject: { contains: string; mode?: 'insensitive' } }
          | { recipient: { contains: string; mode?: 'insensitive' } }
          | { body: { contains: string; mode?: 'insensitive' } }
        >;
      } = {};

      if (userId) {
        whereClause.userId = userId;
      }
      if (status) {
        whereClause.status = status;
      }
      if (recipient) {
        whereClause.recipient = { contains: recipient, mode: 'insensitive' };
      }
      if (subject) {
        whereClause.subject = { contains: subject, mode: 'insensitive' };
      }
      if (q) {
        whereClause.OR = [
          { subject: { contains: q, mode: 'insensitive' } },
          { recipient: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ];
      }

      const dbEmails = await prisma.email.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        skip: offset,
      });

      res.status(200).json({
        success: true,
        data: dbEmails,
        total: dbEmails.length,
        count: dbEmails.length,
        source: 'database_fallback',
        warning: 'Elasticsearch unavailable; results retrieved from PostgreSQL source of truth',
        query: { recipient, subject, status, q },
      });
    }
  } catch (error: unknown) {
    console.error('❌ Error in searchEmails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search emails',
    });
  }
};

