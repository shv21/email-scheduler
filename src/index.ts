import dotenv from 'dotenv';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Email Scheduler Backend is running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`✉️  Schedule Email: POST http://localhost:${PORT}/api/emails`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`====================================================`);
});
