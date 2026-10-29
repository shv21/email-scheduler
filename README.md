# 📬 Email Scheduler - Backend

A minimal, robust email scheduler backend built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**.

---

## 💡 How It Works (In Plain Words)

1. **Client Sends Request**: A client (Postman, web frontend, or mobile app) sends a `POST` request to `/api/emails` with email details:
   - `recipient`: Who will receive the email.
   - `subject`: The subject line.
   - `body`: The email message content.
   - `scheduledAt`: An ISO 8601 timestamp strictly in the future.
2. **Input Validation**: The server inspects the payload using Zod:
   - Verifies `recipient` is a valid email address.
   - Checks that `subject` and `body` are non-empty strings.
   - Verifies that `scheduledAt` is parseable and set in the future.
3. **Database Insertion (Prisma + PostgreSQL)**:
   - Generates a UUID `id`.
   - Saves the record into the `emails` table with status `SCHEDULED`.
   - Captures `created_at` and `updated_at` timestamps.
4. **Response**: Returns an `HTTP 201 Created` confirmation payload containing the full persisted database record.
5. **Health Monitoring**: `GET /health` checks both the Express server uptime and live PostgreSQL connectivity.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma 6
- **Validation**: Zod
- **Development Server**: `tsx watch` (fast TypeScript execution with zero-config auto-reload)

---

## 📂 Project Structure

```text
email-scheduler/
├── prisma/
│   ├── migrations/
│   │   ├── 20261029000000_init/
│   │   │   └── migration.sql      # Initial migration for emails table & enum
│   │   └── migration_lock.toml    # Prisma migration lock
│   └── schema.prisma              # Prisma schema definition
├── src/
│   ├── controllers/
│   │   ├── email.controller.ts    # Logic for email scheduling (Prisma insert)
│   │   └── health.controller.ts   # Logic for health check (DB connectivity)
│   ├── lib/
│   │   └── prisma.ts              # PrismaClient singleton instance
│   ├── routes/
│   │   ├── email.routes.ts        # /api/emails route definitions
│   │   └── health.routes.ts       # /health route definitions
│   ├── types/
│   │   └── email.types.ts         # TypeScript interfaces & types
│   ├── validators/
│   │   └── email.validator.ts     # Schema validation and normalization
│   ├── app.ts                     # Express app configuration & middleware
│   └── index.ts                   # Server entrypoint and port listener
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript compiler settings
└── README.md                      # Project documentation
```

---

## 🗄️ Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EmailStatus {
  SCHEDULED
  PROCESSING
  SENT
  FAILED
}

model Email {
  id          String      @id @default(uuid())
  recipient   String
  subject     String
  body        String      @db.Text
  scheduledAt DateTime    @map("scheduled_at")
  status      EmailStatus @default(SCHEDULED)
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@index([scheduledAt, status])
  @@map("emails")
}
```

---

## 🚀 Setup & Run Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Make sure your `.env` contains your PostgreSQL connection string:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Connection String
# Local example:
DATABASE_URL="postgresql://postgres:password@localhost:5432/email_scheduler?schema=public"

# Cloud example (Supabase, Neon, etc.):
# DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres?schema=public"
```

### 3. Generate Prisma Client
```bash
npm run prisma:generate
# or: npx prisma generate
```

### 4. Apply Database Migrations
```bash
npm run prisma:migrate
# or: npx prisma migrate dev
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Build & Production Start
```bash
npm run build
npm start
```

### 7. View Database with Prisma Studio GUI (Optional)
```bash
npm run prisma:studio
# opens browser UI at http://localhost:5555
```

---

## 📡 API Endpoints & Postman Test Requests

### 1. Health & Database Connectivity Check
- **Method**: `GET`
- **URL**: `http://localhost:5000/health`
- **Success Response (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "email-scheduler-api",
  "uptimeSeconds": 42,
  "database": "connected",
  "timestamp": "2026-10-29T06:55:00.000Z",
  "environment": "development"
}
```

---

### 2. Schedule Email (Insert into PostgreSQL)
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/emails`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body** (`raw` -> `JSON`):
```json
{
  "recipient": "alex.dev@example.com",
  "subject": "Sprint Review Reminder",
  "body": "Hi Alex,\n\nPlease find the sprint review schedule attached for tomorrow.\n\nBest regards,\nEngineering Team",
  "scheduledAt": "2026-11-01T10:00:00.000Z"
}
```
*(Make sure `scheduledAt` is set to any date in the future!)*

#### Expected Response (`201 Created`)
```json
{
  "success": true,
  "message": "Email scheduled and saved to database successfully",
  "data": {
    "id": "e8a946b2-658b-4972-bbcf-29bf8b5a03e1",
    "recipient": "alex.dev@example.com",
    "subject": "Sprint Review Reminder",
    "body": "Hi Alex,\n\nPlease find the sprint review schedule attached for tomorrow.\n\nBest regards,\nEngineering Team",
    "scheduledAt": "2026-11-01T10:00:00.000Z",
    "status": "SCHEDULED",
    "createdAt": "2026-10-29T06:56:00.123Z",
    "updatedAt": "2026-10-29T06:56:00.123Z"
  }
}
```

---

### 3. Validation Error Example
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/emails`
- **Body** (`raw` -> `JSON`):
```json
{
  "recipient": "not-an-email",
  "subject": "",
  "scheduledAt": "2020-01-01T00:00:00.000Z"
}
```
#### Expected Response (`400 Bad Request`)
```json
{
  "success": false,
  "message": "Validation failed: Please ensure all required fields are correctly formatted.",
  "errors": [
    {
      "field": "recipient",
      "message": "recipient must be a valid email address (e.g., user@example.com)"
    },
    {
      "field": "subject",
      "message": "subject cannot be empty"
    },
    {
      "field": "body",
      "message": "body is required"
    },
    {
      "field": "scheduledAt",
      "message": "scheduledAt must be a future date and time"
    }
  ]
}
```
