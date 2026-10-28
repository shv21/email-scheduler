# 📬 Email Scheduler - Backend (Phase 1)

A minimal, robust email scheduler backend built with **Node.js**, **Express**, and **TypeScript**.

Phase 1 focuses on setting up a solid TypeScript foundation, building the core routing structure, input validation, health monitoring, and standardizing JSON API responses. In subsequent phases, persistent storage (PostgreSQL/MongoDB) and background job processing (Redis + BullMQ) will be integrated.

---

## 💡 How It Works (In Plain Words)

1. **Client Sends Request**: A client (Postman, web frontend, or mobile app) sends a `POST` request to `/api/emails` with email details:
   - `recipient`: Who will receive the email.
   - `subject`: The subject line.
   - `body`: The email message content.
   - `scheduledAt`: An ISO 8601 timestamp in the future when the email should be dispatched.
2. **Input Validation**: The server inspects the payload using validation rules:
   - Checks if the email address is valid.
   - Checks that `subject` and `body` are non-empty strings.
   - Verifies that `scheduledAt` is a valid date and strictly in the **future**.
3. **Validation Errors**: If any field is missing or invalid, the server immediately halts and responds with an `HTTP 400 Bad Request` containing a descriptive list of exactly which fields failed and why.
4. **Success Response**: If validation passes, the server generates a unique tracking ID (`email_<uuid>`), marks the status as `scheduled`, and returns an `HTTP 201 Created` confirmation payload.
5. *(Future Phase 2 & 3 preview)*: Instead of just returning an in-memory confirmation, the validated email will be persisted in a database and scheduled onto a Redis/BullMQ delayed job queue to be delivered by a background worker using an email provider (like Nodemailer / SendGrid / Resend).

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Validation**: Zod
- **Development Server**: `tsx watch` (fast TypeScript execution with zero-config auto-reload)

---

## 📂 Project Structure

```text
email-scheduler/
├── src/
│   ├── controllers/
│   │   ├── email.controller.ts    # Logic for email scheduling endpoint
│   │   └── health.controller.ts   # Logic for health check endpoint
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

## 🚀 Run Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

### 3. Start Development Server (with Auto-Reload)
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

### 4. Build for Production
```bash
npm run build
```
Compiles TypeScript into pure JavaScript in the `dist/` directory.

### 5. Start Production Server
```bash
npm start
```

### 6. Type Check
```bash
npm run typecheck
```

---

## 📡 API Endpoints

### 1. Health Check
- **Endpoint**: `GET /health` (or `GET /api/health`)
- **Description**: Verifies that the server is alive and operational.
- **Success Response (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "email-scheduler-api",
  "uptimeSeconds": 14,
  "timestamp": "2026-10-28T10:50:00.000Z",
  "environment": "development"
}
```

---

### 2. Schedule Email
- **Endpoint**: `POST /api/emails`
- **Headers**:
  - `Content-Type: application/json`

#### Validation Rules
| Field | Type | Required | Rules |
| :--- | :--- | :--- | :--- |
| `recipient` | string | Yes | Valid email format (e.g. `user@example.com`) |
| `subject` | string | Yes | Non-empty string, max 255 chars |
| `body` | string | Yes | Non-empty string |
| `scheduledAt` | string (ISO 8601) | Yes | Valid date string strictly in the future |

#### Sample Request Body (Postman)
```json
{
  "recipient": "alex.dev@example.com",
  "subject": "Sprint Review Reminder",
  "body": "Hi Alex,\n\nPlease find the sprint review schedule attached for tomorrow.\n\nBest regards,\nEngineering Team",
  "scheduledAt": "2026-10-29T10:00:00.000Z"
}
```

> **Note**: For testing, make sure `scheduledAt` is set to any future timestamp!

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Email scheduled successfully",
  "data": {
    "id": "email_d9e79b9a-cb7c-4033-9112-9c169a8b1391",
    "recipient": "alex.dev@example.com",
    "subject": "Sprint Review Reminder",
    "body": "Hi Alex,\n\nPlease find the sprint review schedule attached for tomorrow.\n\nBest regards,\nEngineering Team",
    "scheduledAt": "2026-10-29T10:00:00.000Z",
    "status": "scheduled",
    "createdAt": "2026-10-28T10:50:20.123Z"
  }
}
```

#### Error Response (`400 Bad Request`)
If invalid or missing data is sent (e.g. past date or invalid email):
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
      "field": "scheduledAt",
      "message": "scheduledAt must be a future date and time"
    }
  ]
}
```

---

## 🧪 Postman & cURL Quick Test

### cURL: Test Health Endpoint
```bash
curl -X GET http://localhost:5000/health
```

### cURL: Schedule an Email
```bash
curl -X POST http://localhost:5000/api/emails \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "recipient@example.com",
    "subject": "Test Scheduled Email",
    "body": "This is a test email body.",
    "scheduledAt": "2026-12-31T23:59:59.000Z"
  }'
```
