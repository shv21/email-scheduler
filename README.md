# 📬 Full-Stack Email Scheduler - Backend

A production-ready email scheduling backend built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL (Prisma)**, and **Redis (BullMQ)** with **Ethereal Email** dispatch and **Safe Redis Rate Limiting** with **Slack Alerts**.

---

## 💡 Architecture & Flow

```
[Client / Postman]
       │
       ▼ (1) POST /api/emails (sender, recipient, subject, body, scheduledAt)
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
[BullMQ Worker]
       │
       ├──► (5) Check Per-Sender Hourly Limit in Redis:
       │        Key: `ratelimit:sender:<sender>:<YYYY-MM-DD-HH>`
       │
       ├──► [RATE LIMIT EXCEEDED]:
       │    ├── 1. Reschedule job in BullMQ to retry next hour (DO NOT DROP IT!)
       │    ├── 2. Update DB status: 'SCHEDULED' (new target scheduledAt)
       │    └── 3. Trigger Slack Alert ONCE per window (`SET alertKey 1 EX ttl NX`)
       │
       └──► [WITHIN LIMIT]:
            ├── 1. Update DB status: 'PROCESSING'
            ├── 2. Dispatch via Nodemailer (Ethereal SMTP)
            ├── 3. Update DB status: 'SENT'
            └── 4. Output Ethereal Web Preview URL
```

---

## ⏱️ Rate Limiting & Slack Alert Mechanics (Phase 4)

- **Storage**: Redis per-sender counter (`ratelimit:sender:<email>:<hourWindow>`) with automatic hour TTL.
- **Configurable Limit**: Controlled via `HOURLY_EMAIL_LIMIT` in `.env` (default is `1` for immediate testing).
- **Safe Rescheduling**: When a sender exceeds their hourly limit, the job is **not dropped** or failed. The worker calculates the milliseconds remaining until the next hourly window, updates `scheduledAt` in PostgreSQL, and re-enqueues the delayed job in BullMQ.
- **Deduplicated Slack Alerts**: Redis atomic `SET ratelimit:alert:<sender>:<window> 1 EX <ttl> NX` guarantees that the Slack alert is fired **strictly once** per sender per hourly window. Subsequent rate-limited jobs in the same hour are rescheduled without spamming Slack.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue & Scheduler**: Redis + BullMQ (delayed jobs)
- **Rate Limiting**: Redis atomic counters (`INCR`, `EXPIRE`, `SET ... NX`)
- **Alerts**: Slack Webhook Notifications
- **Email Service**: Nodemailer with Ethereal Email
- **Validation**: Zod

---

## 📂 Project Structure

```text
email-scheduler/
├── prisma/
│   ├── migrations/
│   │   └── 20261029000000_init/
│   │       └── migration.sql       # PostgreSQL migration (with sender column & index)
│   └── schema.prisma               # Prisma schema definition
├── src/
│   ├── config/
│   │   └── redis.ts                # Redis connection config & singleton client
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
│   │   ├── email.service.ts        # Nodemailer + Ethereal email transporter
│   │   ├── rate-limiter.service.ts # Redis per-sender hourly rate limiter
│   │   └── slack.service.ts        # Slack webhook alert dispatcher
│   ├── tests/
│   │   └── test-rate-limiting.ts   # Phase 4 Rate Limiting & Slack alert verification test
│   ├── types/
│   │   └── email.types.ts          # DTOs and API types
│   ├── validators/
│   │   └── email.validator.ts      # Zod input schema & normalization
│   ├── workers/
│   │   └── email.worker.ts         # BullMQ worker with rate limiting & rescheduling
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
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Connection (Local or Cloud like Neon/Supabase)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/email_scheduler?schema=public"

# Redis Connection (Local or Cloud like Upstash)
REDIS_URL="redis://localhost:6379"

# Rate Limiting (Emails per hour per sender)
HOURLY_EMAIL_LIMIT=1
DEFAULT_SENDER="sender@example.com"

# Slack Webhook (Optional - logs to console if omitted)
# SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

### 2. Run Database Migration
```bash
npm run prisma:migrate
```

### 3. Start Development Server & Worker
```bash
npm run dev
```

### 4. Run Rate Limiter Verification Test
```bash
npm run test:ratelimit
```

---

## 📮 Postman Test Guide (Two Quick Emails)

Send two requests in quick succession with the **same sender**:

### Request 1: First Email
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/emails`
- **Body**:
```json
{
  "sender": "marketing@acme.com",
  "recipient": "client1@example.com",
  "subject": "Email #1",
  "body": "First email within hourly limit",
  "scheduledAt": "2026-10-29T12:00:00.000Z"
}
```

### Request 2: Second Email (Hits Rate Limit)
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/emails`
- **Body**:
```json
{
  "sender": "marketing@acme.com",
  "recipient": "client2@example.com",
  "subject": "Email #2",
  "body": "Second email from same sender",
  "scheduledAt": "2026-10-29T12:00:00.000Z"
}
```

### What Happens in the Background:
1. **Email #1**: Redis counter increments to `1` (which is $\le$ limit `1`). Passes check, transitions to `PROCESSING`, gets delivered via Ethereal, and marked `SENT`.
2. **Email #2**: Redis counter increments to `2` (which exceeds limit `1`).
   - The job is **not dropped**.
   - Redis atomic `SET ... NX` detects this is the first rate limit hit this hour and **fires the Slack Alert**.
   - The worker calculates the remaining seconds in the hour window and **reschedules the job** in BullMQ and PostgreSQL.
   - Status in PostgreSQL remains `SCHEDULED` with the updated future retry time.
