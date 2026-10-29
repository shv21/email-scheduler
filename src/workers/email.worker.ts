import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queues/email.queue';
import { sendEmail } from '../services/email.service';
import prisma from '../lib/prisma';

let emailWorker: Worker<EmailJobData> | null = null;

/**
 * Initializes and starts the BullMQ worker for processing delayed email jobs.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  if (emailWorker) return emailWorker;

  console.log(`👷 Starting BullMQ worker for queue [${EMAIL_QUEUE_NAME}]...`);

  emailWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, recipient, subject, body } = job.data;
      console.log(`\n⏳ [Worker] Processing email job ${job.id} for recipient: ${recipient}`);

      // 1. Update database status to PROCESSING
      try {
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'PROCESSING' },
        });
      } catch (dbErr) {
        console.warn(`⚠️ [Worker] Could not update status to PROCESSING for ${emailId}:`, dbErr);
      }

      // 2. Dispatch email via Nodemailer & Ethereal
      try {
        const sendResult = await sendEmail({ recipient, subject, body });

        // 3. Update database status to SENT
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SENT' },
        });

        console.log(`✅ [Worker] Successfully processed and marked email ${emailId} as SENT.`);
        return sendResult;
      } catch (sendErr) {
        console.error(`❌ [Worker] Failed to send email ${emailId}:`, sendErr);

        // Update database status to FAILED
        try {
          await prisma.email.update({
            where: { id: emailId },
            data: { status: 'FAILED' },
          });
        } catch (dbErr) {
          console.warn(`⚠️ [Worker] Could not update status to FAILED for ${emailId}:`, dbErr);
        }

        throw sendErr; // rethrow to trigger BullMQ retry/backoff
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    }
  );

  emailWorker.on('completed', (job: Job<EmailJobData>) => {
    console.log(`🎉 [Worker] Job ${job.id} finished successfully!`);
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
