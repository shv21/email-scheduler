# 📬 Full-Stack Email Scheduler - Backend

A production-ready email scheduling backend built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL (Prisma)**, and **Redis (BullMQ)** with **Ethereal Email** dispatch.

---

## 💡 Architecture & Flow (In Plain Words)

```
[Client / Postman]
       │
       ▼ (1) POST /api/emails
[Express API & Zod Validator]
       │
       ▼ (2) Save email record (status: 'SCHEDULED')
[PostgreSQL Database (Prisma)]
       │
       ▼ (3) Enqueue delayed job (delayMs = scheduledAt - now)
[Redis (BullMQ Queue: email-delivery-queue)]
       │
       │ (4) When delay expires
       ▼
[BullMQ Worker] ──► (5) Update DB (status: 'PROCESSING')
       │
       ▼ (6) Send Email via Nodemailer (Ethereal SMTP)
       │
       ▼ (7) Update DB (status: 'SENT' or 'FAILED') + Log Preview URL
```

1. **Client Request**: A client submits recipient email, subject, body, and a future `scheduledAt` timestamp to `POST /api/emails`.
2. **Payload Validation**: Zod validates all fields (format, non-empty, future date).
3. **Database Persistence**: The record is saved in PostgreSQL with status `SCHEDULED`.
4. **Queue Enqueue**: BullMQ calculates `delay = scheduledAt - now` and places a delayed job into Redis.
5. **Worker Execution**: When the scheduled time arrives, the background worker picks up the job, transitions status to `PROCESSING`, delivers the email through Ethereal SMTP, records status as `SENT`, and logs the Ethereal web preview URL.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue & Scheduler**: Redis + BullMQ (delayed jobs)
- **Email Service**: Nodemailer with Ethereal Email (interactive web preview)
- **Validation**: Zod

---

## 📂 Project Structure

```text
email-scheduler/
├── prisma/
│   ├── migrations/
│   │   └── 20261029000000_init/
│   │       └── migration.sql       # PostgreSQL migration
│   └── schema.prisma               # Prisma schema (emails table & EmailStatus enum)
├── src/
│   ├── config/
│   │   └── redis.ts                # Redis connection config for BullMQ & health check
│   ├── controllers/
│   │   ├── email.controller.ts     # Validates, persists to DB, enqueues to Redis
│   │   └── health.controller.ts    # Health check for Express, DB, and Redis
│   ├── lib/
│   │   └── prisma.ts               # PrismaClient singleton
│   ├── queues/
│   │   └── email.queue.ts          # BullMQ Queue instance & enqueue helper
│   ├── routes/
│   │   ├── email.routes.ts         # /api/emails route
│   │   └── health.routes.ts        # /health route
│   ├── services/
│   │   └── email.service.ts        # Nodemailer + Ethereal email transporter
│   ├── types/
│   │   └── email.types.ts          # DTOs and API types
│   ├── validators/
│   │   └── email.validator.ts      # Zod input schema
│   ├── workers/
│   │   └── email.worker.ts         # BullMQ worker for delayed job processing
│   ├── app.ts                      # Express app setup
│   └── index.ts                    # Server & worker bootstrap + graceful shutdown
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Environment Setup & Run Commands

### 1. Configure `.env`
Set your PostgreSQL and Redis connection strings in `.env`:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Connection (Local or Cloud like Neon/Supabase)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/email_scheduler?schema=public"

# Redis Connection (Local or Cloud like Upstash)
REDIS_URL="redis://localhost:6379"
```

> 💡 **Tip for quick testing without local installations**:
> - **PostgreSQL**: You can use a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) database URL.
> - **Redis**: You can use a free [Upstash Redis](https://upstash.com) database URL (`rediss://default:...@...upstash.io:6379`).

### 2. Apply Database Migration
```bash
npm run prisma:migrate
```

### 3. Start Server & BullMQ Worker
```bash
npm run dev
```

---

## 📡 API Endpoints & Postman Testing

### 1. Health & Infrastructure Status Check
- **Method**: `GET`
- **URL**: `http://localhost:5000/health`
- **Response**:
```json
{
  "status": "ok",
  "service": "email-scheduler-api",
  "uptimeSeconds": 14,
  "checks": {
    "database": "connected",
    "redis": "connected"
  },
  "timestamp": "2026-10-29T05:25:00.000Z",
  "environment": "development"
}
```

---

### 2. Schedule Email (Save to DB + Enqueue in Redis)
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/emails`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body** (`raw` -> `JSON`):
```json
{
  "recipient": "alex.dev@example.com",
  "subject": "Delayed Sprint Reminder",
  "body": "Hi Alex,\n\nThis is a delayed test email scheduled via BullMQ and Ethereal.",
  "scheduledAt": "2026-11-01T10:00:00.000Z"
}
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "Email scheduled, persisted in PostgreSQL, and enqueued in Redis BullMQ queue",
  "data": {
    "id": "e8a946b2-658b-4972-bbcf-29bf8b5a03e1",
    "recipient": "alex.dev@example.com",
    "subject": "Delayed Sprint Reminder",
    "body": "Hi Alex,\n\nThis is a delayed test email scheduled via BullMQ and Ethereal.",
    "scheduledAt": "2026-11-01T10:00:00.000Z",
    "status": "SCHEDULED",
    "createdAt": "2026-10-29T05:25:10.123Z",
    "updatedAt": "2026-10-29T05:25:10.123Z",
    "job": {
      "id": "e8a946b2-658b-4972-bbcf-29bf8b5a03e1",
      "delayMs": 275689000,
      "delaySeconds": 275689
    }
  }
}
```

---

## 📬 Worker Delivery & Ethereal Email Preview

When the worker fires, it logs:
```text
⏳ [Worker] Processing email job e8a946b2-... for recipient: alex.dev@example.com
====================================================
✉️ Email Dispatched to: alex.dev@example.com
🆔 Message ID: <18bad612-29cb-8f60-deb1-11e268ed9b0b@ethereal.email>
🔗 Ethereal Preview URL: https://ethereal.email/message/auLYkLvYjsk9eNvcauLYlXOU4XPkrlPeAAAAAXlhajWLpnrxdcrQMufn2m4
====================================================
✅ [Worker] Successfully processed and marked email e8a946b2-... as SENT.
```
Opening the **Ethereal Preview URL** in any web browser lets you view the actual email.
