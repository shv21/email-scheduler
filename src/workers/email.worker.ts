import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobData, addEmailToQueue } from '../queues/email.queue';
import { sendEmail } from '../services/email.service';
import { checkSenderRateLimit } from '../services/rate-limiter.service';
import { sendSlackRateLimitAlert } from '../services/slack.service';
import prisma from '../lib/prisma';
import { updateEmailStatusInIndex } from '../services/elasticsearch.service';

let emailWorker: Worker<EmailJobData> | null = null;

/**
 * Initializes and starts the BullMQ worker for processing delayed email jobs.
 * Implements:
 * 1. Redis per-sender rate limiting check
 * 2. Automatic job rescheduling upon reaching limit (does not drop jobs)
 * 3. Exactly-once Slack alert per hourly window
 * 4. Safe email dispatch via Ethereal
 */
/**
 * Standalone processor function for email jobs.
 * Enforces Part 7 worker safety guarantees:
 * 1. Verifies email existence
 * 2. Skips trashed emails
 * 3. Atomic status check before dispatch
 */
export async function processEmailJob(job: { id?: string; data: EmailJobData }) {
  const { emailId, sender, recipient, subject, body } = job.data;
  const effectiveSender = sender || 'default-sender@example.com';

  console.log(
    `\n⏳ [Worker] Processing email job ${job.id || 'direct'} | Email ID: ${emailId} | Sender: ${effectiveSender} | Recipient: ${recipient}`
  );

      // Part 7 Safety Check 1: Verify email exists in PostgreSQL
      const emailRecord = await prisma.email.findUnique({
        where: { id: emailId },
      });

      if (!emailRecord) {
        console.warn(
          `⚠️ [Worker] Email ${emailId} does not exist in database (permanently deleted). Skipping job.`
        );
        return {
          skipped: true,
          reason: 'EMAIL_NOT_FOUND',
          emailId,
        };
      }

      // Part 7 Safety Check 2: Check whether email is in Trash (deletedAt is not null)
      if (emailRecord.deletedAt !== null) {
        console.warn(
          `🛑 [Worker] Email ${emailId} is in Trash (deletedAt: ${emailRecord.deletedAt.toISOString()}). Delivery cancelled.`
        );
        return {
          skipped: true,
          reason: 'EMAIL_IN_TRASH',
          emailId,
          deletedAt: emailRecord.deletedAt.toISOString(),
        };
      }

      // Safety Check 3: Check if already sent
      if (emailRecord.status === 'SENT') {
        console.log(
          `ℹ️ [Worker] Email ${emailId} is already marked as SENT. Skipping duplicate dispatch.`
        );
        return {
          skipped: true,
          reason: 'ALREADY_SENT',
          emailId,
        };
      }

      // 1. Check Redis per-sender hourly rate limit
      const rateLimit = await checkSenderRateLimit(effectiveSender);

      if (!rateLimit.allowed) {
        console.warn(
          `🛑 [Worker] Rate limit EXCEEDED for sender "${effectiveSender}". Limit is ${rateLimit.limit} email(s)/hour.`
        );

        // 2. Trigger Slack alert ONLY ONCE per hourly window
        if (rateLimit.shouldAlertSlack) {
          console.log(`📢 [Worker] First rate-limit hit for "${effectiveSender}" this hour. Triggering Slack alert...`);
          await sendSlackRateLimitAlert({
            sender: effectiveSender,
            emailId,
            limit: rateLimit.limit,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
        } else {
          console.log(
            `ℹ️ [Worker] Slack alert already fired for sender "${effectiveSender}" in current window (${rateLimit.windowKey}). Skipping duplicate alert.`
          );
        }

        // 3. Reschedule the job for the next hourly window (DO NOT DROP IT!)
        const nextAttemptDate = new Date(Date.now() + rateLimit.retryAfterMs);
        console.log(
          `🔄 [Worker] Rescheduling email ${emailId} for next window in ~${Math.ceil(
            rateLimit.retryAfterSeconds / 60
          )}m (${rateLimit.retryAfterSeconds}s) at ${nextAttemptDate.toISOString()}.`
        );

        // Update PostgreSQL record to reflect rescheduled timestamp (only if not deleted)
        try {
          await prisma.email.updateMany({
            where: { id: emailId, deletedAt: null },
            data: {
              status: 'SCHEDULED',
              scheduledAt: nextAttemptDate,
            },
          });
        } catch (dbErr) {
          console.warn(`⚠️ [Worker] Could not update rescheduled date in DB for ${emailId}:`, dbErr);
        }

        // Update status in Elasticsearch (non-blocking)
        await updateEmailStatusInIndex(emailId, 'SCHEDULED', {
          scheduledAt: nextAttemptDate,
        });

        // Re-enqueue into BullMQ with calculated delay
        await addEmailToQueue(job.data, rateLimit.retryAfterMs);

        return {
          rescheduled: true,
          reason: 'RATE_LIMIT_EXCEEDED',
          sender: effectiveSender,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          nextAttemptAt: nextAttemptDate.toISOString(),
        };
      }

      // 4. Rate limit check passed: Mark DB record as PROCESSING ensuring it is not trashed
      try {
        const updateResult = await prisma.email.updateMany({
          where: { id: emailId, deletedAt: null },
          data: { status: 'PROCESSING' },
        });

        if (updateResult.count === 0) {
          console.warn(
            `🛑 [Worker] Email ${emailId} was trashed or removed while awaiting dispatch. Aborting.`
          );
          return {
            skipped: true,
            reason: 'TRASHED_BEFORE_DISPATCH',
            emailId,
          };
        }
      } catch (dbErr) {
        console.warn(`⚠️ [Worker] Could not update status to PROCESSING for ${emailId}:`, dbErr);
      }

      // Update status in Elasticsearch (non-blocking)
      await updateEmailStatusInIndex(emailId, 'PROCESSING');


      // 5. Dispatch email via Nodemailer & Ethereal
      try {
        const sendResult = await sendEmail({
          sender: effectiveSender,
          recipient,
          subject,
          body,
        });

        // 6. Update database record to SENT
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SENT' },
        });

        // Update status in Elasticsearch (non-blocking)
        await updateEmailStatusInIndex(emailId, 'SENT');

        console.log(`✅ [Worker] Successfully processed and marked email ${emailId} as SENT.`);
        return sendResult;
      } catch (sendErr) {
        console.error(`❌ [Worker] Failed to send email ${emailId}:`, sendErr);

        // Mark as FAILED on dispatch error
        try {
          await prisma.email.update({
            where: { id: emailId },
            data: { status: 'FAILED' },
          });
        } catch (dbErr) {
          console.warn(`⚠️ [Worker] Could not update status to FAILED for ${emailId}:`, dbErr);
        }

        // Update status in Elasticsearch (non-blocking)
        await updateEmailStatusInIndex(emailId, 'FAILED');

        throw sendErr; // rethrow to trigger BullMQ retry/backoff
      }
}

/**
 * Initializes and starts the BullMQ worker for processing delayed email jobs.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  if (emailWorker) return emailWorker;

  console.log(`👷 Starting BullMQ worker for queue [${EMAIL_QUEUE_NAME}]...`);

  emailWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    (job: Job<EmailJobData>) => processEmailJob(job),
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    }
  );

  emailWorker.on('completed', (job: Job<EmailJobData>, result: unknown) => {
    console.log(`🎉 [Worker] Job ${job.id} completed. Result:`, result);
  });

  emailWorker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
    console.error(`💥 [Worker] Job ${job?.id ?? 'unknown'} failed with error: ${err.message}`);
  });

  emailWorker.on('error', (err: Error) => {
    console.error(`⚠️ [Worker] Redis/Worker connection error: ${err.message}`);
  });

  return emailWorker;
}

/**
 * Gracefully shuts down the email worker
 */
export async function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    console.log('🛑 Shutting down BullMQ email worker...');
    await emailWorker.close();
    emailWorker = null;
  }
}
