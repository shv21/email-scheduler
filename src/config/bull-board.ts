import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import { emailQueue } from '../queues/email.queue';

let bullBoardRouter: Router | null = null;

/**
 * Initializes Bull Board dashboard connected to the existing email-delivery BullMQ queue.
 * Reuses the existing emailQueue instance without creating a second queue or duplicating workers.
 * Provides real-time job visualization for waiting, active, delayed, completed, and failed jobs.
 */
export function setupBullBoard(): Router {
  if (bullBoardRouter) {
    return bullBoardRouter;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const router = serverAdapter.getRouter() as Router;
  bullBoardRouter = router;
  return bullBoardRouter;
}

