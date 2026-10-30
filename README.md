# 📬 Full-Stack Email Scheduler & Dashboard

A production-ready full-stack email scheduling platform built with:
- **Backend**: Node.js, Express, TypeScript, Passport.js (Google OAuth 2.0), PostgreSQL (Prisma ORM), Redis (BullMQ delayed queues & per-sender rate limiting), Nodemailer (Ethereal SMTP), Elasticsearch (distributed search & analytics), Bull Board (real-time queue monitoring UI).
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
5. **Elasticsearch Search Integration (Phase 6 Part A)**:
   - Official `@elastic/elasticsearch` JavaScript client.
   - Dedicated `emails` index with optimized field mappings for keywords, text search, and dates.
   - Non-blocking document indexing upon creation and automatic document status updates across worker state transitions (`SCHEDULED` ➔ `PROCESSING` ➔ `SENT` / `FAILED`).
   - Protected search API (`GET /api/emails/search`) with multi-tenant user isolation supporting `recipient`, `subject`, `status`, and free-text queries (`q`).
   - Resilient architecture: PostgreSQL is the definitive source of truth; Elasticsearch failures never break database transactions or job processing, and search automatically falls back to PostgreSQL.
6. **BullMQ Queue Dashboard with Bull Board (Phase 6 Part B)**:
   - Embedded `@bull-board/express` and `@bull-board/api` monitoring dashboard at `/admin/queues`.
   - Connected directly to the single existing `email-delivery-queue` instance (no duplicate queues or workers).
   - Real-time visualization of `waiting`, `active`, `delayed`, `completed`, and `failed` jobs.
   - Protected with the application's session authentication system (`requireAuth`).
7. **Modern React Dashboard**:
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
       │          ├── 3. Enqueue delayed job into Redis BullMQ (single queue)
       │          └── 4. Asynchronously index document into Elasticsearch (non-blocking)
       │
       ├──► (5) GET /api/emails/search (Search by recipient, subject, status)
       │          ▼ [Elasticsearch Index / PostgreSQL Fallback]
       │
       ├──► (6) GET /admin/queues (Bull Board Dashboard UI - Protected by Session)
       │          ▼ [Bull Board: @bull-board/express]
       │          └── Real-time inspection of waiting, active, delayed, completed, failed jobs
       │
       └──► (7) When delay expires:
                  ▼ [BullMQ Background Worker]
                  ├── Check Redis Rate Limit
                  ├── If rate limited: reschedule job, update ES + DB, trigger Slack alert once
                  ├── If allowed: update status to PROCESSING in DB + ES
                  ├── Dispatch via Ethereal SMTP
                  └── Mark status as SENT (or FAILED) in PostgreSQL + Elasticsearch
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
│   │   ├── bull-board.ts          # 📊 Bull Board setup & queue adapter configuration
│   │   ├── elasticsearch.ts       # 🔍 Elasticsearch client & cluster health check
│   │   ├── passport.ts            # Google OAuth Strategy & session serialization
│   │   └── redis.ts               # Redis connection & singleton client
│   ├── controllers/
│   │   ├── auth.controller.ts     # User info, logout, and dev login
│   │   ├── email.controller.ts    # Protected email creation, search, and listing
│   │   └── health.controller.ts   # DB, Redis, and Elasticsearch health monitor
│   ├── middlewares/
│   │   └── auth.middleware.ts     # requireAuth session guard (JSON & browser HTML)
│   ├── queues/
│   │   └── email.queue.ts         # BullMQ queue & delay calculation
│   ├── routes/
│   │   ├── auth.routes.ts         # /api/auth endpoints
│   │   ├── email.routes.ts        # Protected /api/emails & /api/emails/search endpoints
│   │   └── health.routes.ts       # /health endpoint
│   ├── services/
│   │   ├── elasticsearch.service.ts # 🔍 Index creation, document indexing & search
│   │   ├── email.service.ts       # Nodemailer Ethereal SMTP transporter
│   │   ├── rate-limiter.service.ts# Redis per-sender hourly rate limiter
│   │   └── slack.service.ts       # Slack webhook alert dispatcher
│   ├── tests/
│   │   ├── test-auth.ts           # Automated auth & ownership tests
│   │   ├── test-bull-board.ts     # 📊 Automated BullMQ Dashboard & queue tests
│   │   ├── test-elasticsearch.ts  # 🔍 Automated Elasticsearch indexing & search tests
│   │   └── test-rate-limiting.ts  # Automated rate limit verification
│   ├── app.ts                     # Express setup, sessions, CORS, Bull Board mount
│   └── index.ts                   # Backend bootstrap & worker startup
├── .env.example
├── package.json
└── README.md
```

---

## 🔍 How to Start Elasticsearch

Elasticsearch can be run locally using Docker or via Elastic Cloud.

### Option 1: Docker (Recommended for Local Development)

Run a single-node Elasticsearch 8.x instance with security disabled for local testing:

```bash
docker run -d \
  --name email-scheduler-elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.15.0
```

Verify that Elasticsearch is responding:
```bash
curl http://localhost:9200
```

### Option 2: Elastic Cloud or Authenticated Remote Cluster

Set the following variables in your `.env` file:
```env
ELASTICSEARCH_NODE="https://your-elastic-deployment.es.io:9243"
ELASTICSEARCH_INDEX="emails"
ELASTICSEARCH_API_KEY="your-base64-encoded-api-key"
# Or provide username and password:
# ELASTICSEARCH_USERNAME="elastic"
# ELASTICSEARCH_PASSWORD="your-elastic-password"
```

> **Resilience Guarantee**: If Elasticsearch is stopped or unreachable, the application starts cleanly, PostgreSQL transactions and BullMQ worker jobs function without errors, and the search API automatically falls back to querying PostgreSQL directly (`source: 'database_fallback'`).

---

## 📊 How to Access the BullMQ Dashboard

The BullMQ Dashboard is mounted at:
```
http://localhost:5000/admin/queues
```

### Authentication Protection
The dashboard is guarded by the application's authentication system (`requireAuth`):
1. **Unauthenticated browser access**: Navigating directly to `http://localhost:5000/admin/queues` without an active session displays an unauthorized page prompting login.
2. **Authenticated access**:
   - Log in via Google OAuth on the frontend (`http://localhost:5173`), OR
   - Call the development quick-login helper (`POST /api/auth/dev-login`) to obtain a session cookie.
   - Navigate to `http://localhost:5000/admin/queues` to access the live dashboard.

### Dashboard Features
- **Queue**: Directly displays the active `email-delivery-queue`.
- **States**: View job counts and individual payloads across `waiting`, `active`, `delayed`, `completed`, and `failed`.
- **Job Inspection**: Click any delayed job to inspect the email payload, sender, recipient, delay time, and retry attempts.
- **Actions**: Retry failed jobs or clean up completed jobs directly from the UI.

---

## 🚀 Installation & Run Commands

### 1. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Ensure your `.env` contains:
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL` (Redis connection string, e.g. `redis://localhost:6379`)
- `ELASTICSEARCH_NODE="http://localhost:9200"`
- `ELASTICSEARCH_INDEX="emails"`
- `CLIENT_URL="http://localhost:5173"`
- `SESSION_SECRET="your-secure-session-secret"`

### 3. Run Database Migrations
```bash
npm run prisma:deploy
```

### 4. Start the Application
Open two terminal windows:

**Terminal 1 (Backend Server + BullMQ Worker + Elasticsearch Init + Bull Board)**:
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

Verify features independently with dedicated test suites:

```bash
# 1. Test Elasticsearch integration, indexing, status updates, search API, and resilience:
npm run test:elasticsearch

# 2. Test BullMQ Dashboard integration, auth protection, and real-time queue synchronization:
npm run test:bullboard

# 3. Test Google OAuth, Sessions, requireAuth protection, and Logout:
npm run test:auth

# 4. Test Safe Redis Rate Limiter, Rescheduling, and Slack Alert Deduplication:
npm run test:ratelimit

# 5. Typecheck & Build validations:
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
| `POST` | `/api/emails` | Schedules a new email, persists to DB, queues in BullMQ, and indexes in ES | Yes |
| `GET` | `/api/emails` | Lists current user's emails (`?status=...`) from PostgreSQL | Yes |
| `GET` | `/api/emails/search` | Protected search by `recipient`, `subject`, `status`, or query `q` | Yes |
| `GET` | `/api/emails/:id` | Returns single email belonging to user | Yes |

### Monitoring & Operations
| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health check for PostgreSQL, Redis, and Elasticsearch | No |
| `GET` | `/admin/queues` | BullMQ Queue Dashboard (waiting, active, delayed, completed, failed) | Yes (Session) |

---

## 📝 Files Created or Modified in Phase 6

### New Files Created
1. `src/config/elasticsearch.ts`: Elasticsearch client singleton, health check, and graceful close handler.
2. `src/services/elasticsearch.service.ts`: Index initialization, document indexing, status updating, and search bool queries.
3. `src/config/bull-board.ts`: Bull Board ExpressAdapter and BullMQAdapter initialization connecting the existing `emailQueue`.
4. `src/tests/test-elasticsearch.ts`: Automated test suite for Elasticsearch indexing, queries, multi-tenancy, and PostgreSQL fallback.
5. `src/tests/test-bull-board.ts`: Automated test suite for dashboard auth protection, counter accuracy, and real-time delayed job tracking.

### Files Modified
1. `src/types/email.types.ts`: Added `EmailDocument`, `EmailSearchParams`, and extended `ApiSuccessResponse` for search metadata and fallback source reporting.
2. `src/controllers/email.controller.ts`: Added non-blocking Elasticsearch document indexing in `createScheduledEmail`, added protected `searchEmails` controller with PostgreSQL fallback.
3. `src/routes/email.routes.ts`: Registered `GET /emails/search` protected with `requireAuth` ahead of `/:id`.
4. `src/workers/email.worker.ts`: Added non-blocking status updates to Elasticsearch (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`) without impacting worker execution.
5. `src/controllers/health.controller.ts`: Added `elasticsearch` connectivity check to `/health` endpoint.
6. `src/middlewares/auth.middleware.ts`: Enhanced `requireAuth` to serve a styled 401 HTML page for browser visits to `/admin/queues` while retaining standard JSON 401 for API endpoints.
7. `src/app.ts`: Mounted `/admin/queues` protected by `requireAuth` using `setupBullBoard()`, updated root endpoint documentation.
8. `src/index.ts`: Added Elasticsearch index initialization at startup, added Elasticsearch client close on graceful shutdown, and logged Bull Board dashboard URL.
9. `package.json`: Added `@elastic/elasticsearch`, `@bull-board/express`, `@bull-board/api` dependencies; added `test:elasticsearch` and `test:bullboard` scripts.
10. `.env.example`: Added Elasticsearch configuration parameters (`ELASTICSEARCH_NODE`, `ELASTICSEARCH_INDEX`, optional credentials).
11. `.env`: Added local default Elasticsearch settings.
12. `README.md`: Documented Phase 6 Part A and Part B, start instructions, access guide, endpoints, and test commands.

---

## ⚠️ Known Limitations & Considerations

1. **Near-Real-Time Indexing**: Elasticsearch has an internal refresh interval (default 1s). In production environments, search queries executed within milliseconds of creation might see a slight propagation delay unless refreshed. The test suite explicitly refreshes the index when immediate search validation is needed.
2. **PostgreSQL as Primary Source of Truth**: Elasticsearch operates strictly as a secondary read/search model. If Elasticsearch experiences extended downtime, newly created emails remain safely saved in PostgreSQL and BullMQ, but may need a bulk re-sync script if the Elasticsearch cluster is recreated from scratch.
3. **Admin Dashboard Authorization Level**: The BullMQ dashboard is currently protected by standard user session authentication (`requireAuth`). In an enterprise multi-tenant setup, this should be further restricted with an admin role guard (e.g. `requireAdmin` based on `user.role === 'ADMIN'`).
