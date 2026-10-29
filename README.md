# 📬 Full-Stack Email Scheduler & Dashboard

A production-ready full-stack email scheduling platform built with:
- **Backend**: Node.js, Express, TypeScript, Passport.js (Google OAuth 2.0), PostgreSQL (Prisma ORM), Redis (BullMQ delayed queues & per-sender rate limiting), Nodemailer (Ethereal SMTP).
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide icons, Vite.

---

## 🌟 Features Overview

1. **Google OAuth 2.0 & Session Security**:
   - Secure login via Google Accounts using Passport.js.
   - HTTP-only session cookies with CSRF & credential protection.
   - Protected email endpoints ensuring users only access their own scheduled emails.
   - Development quick-login helper for instant local testing without live credentials.
2. **Delayed Job Scheduling with BullMQ & Redis**:
   - Background jobs delayed to dispatch at an exact future date and time.
   - High-throughput queueing with exponential backoff on failures.
3. **Safe Per-Sender Redis Rate Limiting**:
   - Atomic per-sender hourly counters stored in Redis.
   - Automatic rescheduling on limit exceed (jobs are never dropped).
   - Exactly-once Slack alerts per hourly window.
4. **Nodemailer + Ethereal Email Delivery**:
   - Automated sandbox delivery with instant web preview URLs.
5. **Modern React Dashboard**:
   - Responsive UI with Tabs for Scheduled and Sent emails.
   - Live polling for real-time status transitions (`SCHEDULED` ➔ `PROCESSING` ➔ `SENT`).
   - Compose modal with email format validation and quick time presets (+5m, +30m, +1h, tomorrow).

---

## 📐 Architecture & Flow

```
[React Dashboard (Vite: 5173)]
       │
       ├──► (1) GET /api/auth/google ──► [Google Accounts Consent]
       │                                         │
       ├──◄ (2) Callback with session cookie ────┘
       │
       ├──► (3) GET /api/auth/me (Returns user profile: name, email, avatar)
       │
       ├──► (4) POST /api/emails (Compose email with future scheduledAt)
       │          │
       │          ▼ [Express Backend: 5000]
       │          ├── 1. requireAuth check (validates session cookie)
       │          ├── 2. Save record to PostgreSQL via Prisma (associated with userId)
       │          └── 3. Enqueue delayed job into Redis BullMQ
       │
       └──► (5) When delay expires:
                  ▼ [BullMQ Background Worker]
                  ├── Check Redis Rate Limit
                  ├── If rate limited: reschedule job & trigger Slack alert once
                  └── If allowed: dispatch via Ethereal SMTP & mark SENT in DB
```

---

## 🛠️ Project Structure

```text
email-scheduler/
├── client/                        # ⚡ React + TypeScript + Tailwind Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx         # User profile, avatar, compose button, logout
│   │   │   ├── LoginView.tsx      # Google OAuth login + Quick Dev Login
│   │   │   ├── StatsCards.tsx     # Overview metrics (Scheduled, Sent, Failed)
│   │   │   ├── EmailTable.tsx     # Filterable tabs (Scheduled vs Sent) & search
│   │   │   └── ComposeModal.tsx   # Modal with validation & quick presets
│   │   ├── services/
│   │   │   └── api.ts             # Fetch client with credentials included
│   │   ├── types.ts               # Shared frontend TypeScript interfaces
│   │   ├── App.tsx                # Main state & polling coordinator
│   │   └── main.tsx               # Client entrypoint
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.ts             # Proxy /api to backend:5000
├── prisma/
│   ├── migrations/                # PostgreSQL migration SQL (users + emails)
│   └── schema.prisma              # User & Email models with relations
├── src/                           # ⚡ Express TypeScript Backend
│   ├── config/
│   │   ├── passport.ts            # Google OAuth Strategy & session serialization
│   │   └── redis.ts               # Redis connection & singleton client
│   ├── controllers/
│   │   ├── auth.controller.ts     # User info, logout, and dev login
│   │   ├── email.controller.ts    # Protected email creation and listing
│   │   └── health.controller.ts   # DB and Redis health monitor
│   ├── middlewares/
│   │   └── auth.middleware.ts     # requireAuth session guard
│   ├── queues/
│   │   └── email.queue.ts         # BullMQ queue & delay calculation
│   ├── routes/
│   │   ├── auth.routes.ts         # /api/auth endpoints
│   │   ├── email.routes.ts        # Protected /api/emails endpoints
│   │   └── health.routes.ts       # /health endpoint
│   ├── services/
│   │   ├── email.service.ts       # Nodemailer Ethereal SMTP transporter
│   │   ├── rate-limiter.service.ts# Redis per-sender hourly rate limiter
│   │   └── slack.service.ts       # Slack webhook alert dispatcher
│   ├── tests/
│   │   ├── test-auth.ts           # Automated auth & ownership tests
│   │   └── test-rate-limiting.ts  # Automated rate limit verification
│   ├── app.ts                     # Express setup, sessions, CORS, Passport
│   └── index.ts                   # Backend bootstrap & worker startup
├── .env.example
├── package.json
└── README.md
```

---

## 🔑 Google Cloud Console Setup Guide

To enable live Google OAuth:

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Open **APIs & Services** ➔ **OAuth consent screen**:
   - User Type: **External**.
   - App Name: `Email Scheduler`.
   - Add scopes: `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
   - Add your test Google account email under **Test users**.
4. Open **APIs & Services** ➔ **Credentials**:
   - Click **Create Credentials** ➔ **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Email Scheduler Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:5000`
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/auth/google/callback`
5. Copy your **Client ID** and **Client Secret** into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"
   ```

---

## 🚀 Exact Installation & Run Commands

### 1. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install client dependencies
npm --prefix client install
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Ensure your `.env` contains:
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL` (Redis connection string, e.g. `redis://localhost:6379`)
- `CLIENT_URL="http://localhost:5173"`
- `SESSION_SECRET="your-secure-session-secret"`

### 3. Run Database Migrations
```bash
npm run prisma:migrate
npm run prisma:generate
```

### 4. Start the Application
Open two terminal windows:

**Terminal 1 (Backend Server + BullMQ Worker)**:
```bash
npm run dev
```
*Backend runs on `http://localhost:5000`.*

**Terminal 2 (React Dashboard)**:
```bash
npm run client:dev
```
*React frontend runs on `http://localhost:5173`.*

---

## 🧪 Automated Testing Commands

Verify features independently with built-in test suites:

```bash
# 1. Test Google OAuth, Sessions, requireAuth protection, and Logout:
npm run test:auth

# 2. Test Safe Redis Rate Limiter, Rescheduling, and Slack Alert Deduplication:
npm run test:ratelimit

# 3. Test TypeScript compilation for Backend and Frontend:
npm run typecheck
npm run client:build
```

---

## 📮 API Endpoints Reference

### Authentication Endpoints
| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/google` | Initiates Google OAuth consent screen | No |
| `GET` | `/api/auth/google/callback` | Google OAuth callback (sets session cookie) | No |
| `GET` | `/api/auth/me` | Returns current user profile | Yes |
| `POST` | `/api/auth/logout` | Clears session cookie and logs out | Yes |
| `POST` | `/api/auth/dev-login` | Quick development login (bypasses consent) | No (Dev only) |

### Email Endpoints
| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/emails` | Schedules a new email for current user | Yes |
| `GET` | `/api/emails` | Lists current user's emails (`?status=...`) | Yes |
| `GET` | `/api/emails/:id` | Returns single email belonging to user | Yes |
