import dotenv from 'dotenv';
import app from './app';
import { startEmailWorker, stopEmailWorker } from './workers/email.worker';
import prisma from './lib/prisma';
import { emailQueue } from './queues/email.queue';
import { getSharedRedisClient } from './config/redis';
import { initElasticsearchIndex } from './services/elasticsearch.service';
import { closeElasticsearchClient } from './config/elasticsearch';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// 1. Start BullMQ Worker
const worker = startEmailWorker();

// 2. Initialize Elasticsearch Index (non-blocking)
initElasticsearchIndex().catch((err) => {
  console.warn('⚠️ [Elasticsearch] Initialization error:', err);
});

// 3. Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Email Scheduler Backend is running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`✉️  Schedule Email: POST http://localhost:${PORT}/api/emails`);
  console.log(`🔍 Search Emails: GET http://localhost:${PORT}/api/emails/search`);
  console.log(`📊 BullMQ Dashboard: http://localhost:${PORT}/admin/queues (Protected)`);
  console.log(`⏱️  Hourly Email Limit: ${process.env.HOURLY_EMAIL_LIMIT ?? '1'} email(s)/hour per sender`);

  console.log(`⚙️  Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`====================================================`);
});

// 4. Graceful Shutdown Handler
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new HTTP requests
    server.close(() => {
      console.log('🔒 HTTP server closed.');
    });

    // Close BullMQ worker & queue
    await stopEmailWorker();
    await emailQueue.close();
    console.log('🔒 BullMQ worker and queue closed.');

    // Close shared Redis client
    try {
      getSharedRedisClient().disconnect();
      console.log('🔒 Shared Redis client closed.');
    } catch {}

    // Close Elasticsearch client
    try {
      await closeElasticsearchClient();
      console.log('🔒 Elasticsearch client closed.');
    } catch {}

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('🔒 PostgreSQL Prisma connection closed.');

    console.log('👋 Graceful shutdown complete. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('⚠️ Error during graceful shutdown:', err);
    process.exit(1);
  }
}


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
