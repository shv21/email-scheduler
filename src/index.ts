import dotenv from 'dotenv';
import app from './app';
import { startEmailWorker, stopEmailWorker } from './workers/email.worker';
import prisma from './lib/prisma';
import { emailQueue } from './queues/email.queue';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// 1. Start BullMQ Worker
const worker = startEmailWorker();

// 2. Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Email Scheduler Backend is running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`✉️  Schedule Email: POST http://localhost:${PORT}/api/emails`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`====================================================`);
});

// 3. Graceful Shutdown Handler
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
