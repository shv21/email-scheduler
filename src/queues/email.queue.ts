import { Queue, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-delivery-queue';

export interface EmailJobData {
  emailId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error(`⚠️ BullMQ Queue [${EMAIL_QUEUE_NAME}] error:`, err.message);
});

/**
 * Enqueues a delayed email sending job into Redis via BullMQ
 * @param data Email details including sender and emailId
 * @param delayMs Milliseconds to delay execution
 */
export async function addEmailToQueue(
  data: EmailJobData,
  delayMs: number
): Promise<Job<EmailJobData>> {
  const safeDelay = Math.max(0, delayMs);

  const job = await emailQueue.add(
    `send-email-${data.emailId}`,
    data,
    {
      delay: safeDelay,
      jobId: `${data.emailId}-${Date.now()}`,
    }
  );

  console.log(
    `📥 Enqueued job for email ${data.emailId} | Sender: ${data.sender} | Delay: ${safeDelay}ms (~${Math.round(safeDelay / 1000)}s)`
  );

  return job;
}
