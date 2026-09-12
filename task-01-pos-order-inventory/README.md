# Real-Time Point of Sale (POS) Order & Inventory Management System

A production-grade, highly concurrent POS Order & Inventory Management System built with **TypeScript**, **Node.js/Express**, **Prisma ORM (v7.10.0)**, **PostgreSQL (Neon serverless)**, and **Next.js (App Router)**.

---

## 🚀 Live Deployment Links

- **Backend API (Render)**: `https://techloom-pos-backend.onrender.com`
- **Frontend App (Vercel)**: `https://techloom-pos-frontend.vercel.app`

---

## 📌 Project Overview & Key Features

This application solves the core challenge of real-time inventory control in a multi-cashier environment: **preventing stock overselling during high-concurrency checkouts** while supporting temporary cart holds, restart-safe reservation expirations, mock payments, and role-based staff operations.

### Key Features:
- **Authentication & RBAC**:
  - Staff authentication via JWT Access Tokens (15-min lifespan) and HttpOnly Refresh Cookies (7-day lifespan).
  - Strict Role-Based Access Control (`ADMIN` vs `CASHIER`).
  - Refresh token rotation with immediate detection and rejection of reused/stale tokens.
- **Real-Time Inventory Model**:
  - Single source of truth: `Product.stock` represents live available stock for purchase.
  - Immediate atomic reservation upon checkout; automatic restoration upon expiry, payment failure, or cancellation.
- **Concurrent Checkout Engine**:
  - Zero overselling under race conditions, verified via true concurrent HTTP test suites using PostgreSQL `REPEATABLE READ` / `SERIALIZABLE` isolation and atomic conditional `UPDATE` statements.
- **Restart-Safe Reservation Expiry**:
  - Dual-layer expiration strategy: background interval sweeper + on-demand lazy expiration check on order reads.
- **Idempotency & State Machine**:
  - Strict Order State Machine (`RESERVED` $\rightarrow$ `PAID` / `EXPIRED` / `CANCELLED` / `FAILED`).
  - Unique-constraint-backed idempotency for checkout and payment operations with P2002 error recovery.
- **Responsive POS Frontend**:
  - Next.js App Router with live reservation countdown timer, automated token refresh interceptor, loading state guards, and user-facing notifications.

---

## 🛠️ Tech Stack

### Backend Stack
- **Runtime**: Node.js (ES Modules, TypeScript 7.0)
- **Framework**: Express.js v5.2
- **Database & ORM**: PostgreSQL (Neon Serverless) + Prisma ORM v7.10.0 with `@prisma/adapter-pg`
- **Validation**: Zod v4.6
- **Testing**: Vitest v5.0 + Supertest v7.2
- **Security**: `bcryptjs` (Cost factor 12), `jsonwebtoken`, `cors`, HttpOnly Cookies

### Frontend Stack
- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Vanilla CSS Modules / Global Design System tokens (dark/light themes, glassmorphism UI)
- **State Management**: React Context (`AuthContext`, `CartContext`)

---

## 🏛️ Architecture Summary

The backend adheres to a strict 4-layer decoupled architecture:

```
[ HTTP Client / Frontend ]
          │
          ▼
┌───────────────────┐
│   Controller      │  Extracts HTTP parameters, handles response envelope
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│    Service        │  Business logic, transactions, state machine, concurrency
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Repository      │  Data access abstractions and query encapsulation
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Prisma ORM      │  Type-safe queries against PostgreSQL (Neon)
└───────────────────┘
```

---

## 📁 Folder Structure

```
task-01-pos-order-inventory/
├── backend/
│   ├── prisma/
│   │   ├── migrations/       # SQL migration history files
│   │   ├── schema.prisma     # Prisma data model & enum definitions
│   │   └── seed.ts           # Staff account seed script
│   ├── src/
│   │   ├── config/           # Envs (Zod validated), Prisma client singleton
│   │   ├── controllers/      # Request handlers & HTTP envelope formatters
│   │   ├── jobs/             # In-process reservation expiry sweeper
│   │   ├── middleware/       # Auth (JWT), RBAC, Zod validation, Error handler
│   │   ├── repositories/     # Data access layer (User, Product, Cart, RefreshToken)
│   │   ├── routes/           # Express router declarations
│   │   ├── services/         # Business logic, state machine, checkout transaction
│   │   ├── types/            # Express request & custom type definitions
│   │   ├── utils/            # JWT signing, password hashing, custom Error classes
│   │   ├── validators/       # Zod input schemas
│   │   ├── app.ts            # Express application setup
│   │   └── server.ts         # Server listener & background sweeper bootstrap
│   ├── tests/
│   │   ├── auth/             # Authentication & token rotation tests
│   │   ├── concurrency/      # True concurrent checkout & stock lock tests
│   │   ├── integration/      # Product, Cart, Order, Payment & Cancellation tests
│   │   └── unit/             # Order state machine & Zod validator unit tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/                  # Next.js App Router pages (login, POS, cart, orders, etc.)
│   ├── components/           # Navbar, CountdownTimer, ProtectedRoute, Toast
│   ├── lib/                  # AuthContext, CartContext, API fetch client
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 🔑 Environment Variables (Names Only)

> [!IMPORTANT]
> Secrets and connection strings must **never** be committed to version control. Set these in your local `.env` files or platform dashboards (Render / Vercel).

### Backend (`backend/.env`)
- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_CASHIER_EMAIL`
- `SEED_CASHIER_PASSWORD`

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`

---

## 💻 Local Setup & Execution Instructions

### Prerequisites
- Node.js v20+ or v24+
- PostgreSQL database (or Neon PostgreSQL instance connection URL)

### 1. Clone & Install Dependencies
```bash
# Navigate to backend and install
cd backend
npm install

# Navigate to frontend and install
cd ../frontend
npm install
```

### 2. Environment Configuration
Create `backend/.env` based on `backend/.env.example`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/pos_db?sslmode=require"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"
JWT_ACCESS_SECRET="your_access_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"
SEED_ADMIN_EMAIL="admin@techloom.ai"
SEED_ADMIN_PASSWORD="Admin@123456"
SEED_CASHIER_EMAIL="cashier@techloom.ai"
SEED_CASHIER_PASSWORD="Cashier@123456"
```

Create `frontend/.env.local` based on `frontend/.env.example`:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 3. Database Migration & Seeding

> [!NOTE]
> **Prisma Migration Command Distinction**:
> - `npx prisma migrate dev`: Used in **LOCAL DEVELOPMENT ONLY**. It creates new SQL migration files when schema changes, applies them, and generates the Prisma Client. Never run against production.
> - `npx prisma migrate deploy`: Used in **PRODUCTION ONLY**. It safely applies existing, committed migration files without resetting or altering schema state.

Run local migrations and seed initial staff accounts:
```bash
cd backend
npx prisma migrate dev --name init
npm run seed
```

### 4. Running Backend & Frontend Locally
```bash
# Terminal 1: Run Backend Dev Server
cd backend
npm run dev

# Terminal 2: Run Frontend Dev Server
cd frontend
npm run dev
```

The frontend will be accessible at `http://localhost:3000` and the backend API at `http://localhost:4000`.

---

## 🧪 Testing Suite Instructions

The project includes unit, integration, authentication, and high-concurrency test suites powered by Vitest.

```bash
cd backend

# Run all automated tests sequentially (concurrency-safe)
npm test

# Run authentication tests specifically
npx vitest run tests/auth/auth.test.ts

# Run true concurrency & overselling prevention tests specifically
npx vitest run tests/concurrency/checkout_concurrency.test.ts
```

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description | Auth Required | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Render Service Health Check | None | Public |
| `POST` | `/api/auth/login` | Authenticate staff member | None | Public |
| `POST` | `/api/auth/refresh` | Rotate access & refresh tokens | Refresh Token | Public |
| `POST` | `/api/auth/logout` | Revoke active refresh token | None | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Bearer Token | `ADMIN`, `CASHIER` |
| `GET` | `/api/products` | List all active products | Bearer Token | `ADMIN`, `CASHIER` |
| `GET` | `/api/products/:id` | Get product details by ID | Bearer Token | `ADMIN`, `CASHIER` |
| `POST` | `/api/products` | Create a new product | Bearer Token | `ADMIN` only |
| `PUT` | `/api/products/:id` | Update product details/stock | Bearer Token | `ADMIN` only |
| `DELETE`| `/api/products/:id` | Soft-delete a product | Bearer Token | `ADMIN` only |
| `POST` | `/api/carts` | Create a new cart for user | Bearer Token | `ADMIN`, `CASHIER` |
| `GET` | `/api/carts/:id` | Get cart contents (Owner only) | Bearer Token | Owner |
| `POST` | `/api/carts/:id/items` | Add item to cart | Bearer Token | Owner |
| `PATCH` | `/api/carts/:id/items/:itemId` | Update cart item quantity | Bearer Token | Owner |
| `DELETE`| `/api/carts/:id/items/:itemId` | Remove item from cart | Bearer Token | Owner |
| `POST` | `/api/checkout` | Convert cart to RESERVED order | Bearer Token | Owner |
| `GET` | `/api/orders` | List user's orders (All if Admin)| Bearer Token | `ADMIN`, `CASHIER` |
| `GET` | `/api/orders/:id` | Get order details | Bearer Token | Owner or `ADMIN` |
| `POST` | `/api/orders/:id/payment` | Submit payment (SUCCESS/FAIL) | Bearer Token | Owner or `ADMIN` |
| `POST` | `/api/orders/:id/cancel` | Cancel order & restore stock | Bearer Token | Owner or `ADMIN` |

---

## 📚 Deep-Dive Technical Design & Concepts

### 1. Inventory & Stock Model (Section 6)
In this system, `Product.stock` represents the **true available stock** eligible for purchase.
- When an order checkout is executed, the requested quantities are immediately subtracted from `Product.stock` and recorded inside `Reservation` rows with `status = ACTIVE` and `expiresAt = NOW() + 5 minutes`.
- This ensures available stock is instantly protected against overselling without relying on complex, un-persisted memory queues.
- If an order expires, fails payment, or is cancelled, stock is incremented back into `Product.stock` and the reservation is updated to `RELEASED`.

### 2. Concurrency & Overselling Strategy (Section 7)
To prevent race conditions when multiple cashiers attempt to buy the last unit of a product simultaneously:
- **Atomic Conditional Updates**: Stock decrement operations are executed using PostgreSQL atomic conditional updates:
  ```sql
  UPDATE "Product"
  SET "stock" = "stock" - $quantity
  WHERE "id" = $productId AND "stock" >= $quantity;
  ```
- **Serializable Isolation**: The entire checkout process (verifying cart, decrementing stock, creating order, creating reservations, clearing cart) runs within a single PostgreSQL `SERIALIZABLE` or `REPEATABLE READ` transaction block.
- **Bounded Retry**: If PostgreSQL throws a serialization error (Code `P2034` or deadlock), the service automatically retries the operation up to 3 times with exponential backoff before surfacing a clean `409 Conflict` error.

### 3. Reservation Expiry Design (Section 9)
The reservation expiration architecture is **restart-safe** and does not rely on transient in-memory timers:
- **Persisted Expiration Timestamp**: Every active reservation holds a database-persisted `expiresAt` column.
- **In-Process Background Sweeper**: A background job (`reservationExpirySweeper.ts`) polls every 30 seconds for active reservations where `expiresAt < NOW()`. Each expired reservation is processed in its own transaction to release stock and update order status to `EXPIRED`.
- **Lazy Expiration Check**: On any read or payment action for an order, `expireReservationIfDue` executes inline. If the reservation has crossed its expiry timestamp, it is expired on the fly before processing the request, ensuring zero race windows even if the sweeper interval has not fired yet.

### 4. Idempotency & Payment Handling (Sections 10 & 18)
- Both `POST /api/checkout` and `POST /api/orders/:id/payment` enforce idempotency via an `idempotencyKey` field.
- **3-Layer Idempotency Model**:
  1. *Pre-check*: Look up existing records by `idempotencyKey`. If found, return stored result immediately.
  2. *Transactional execution*: Perform operations within the database transaction.
  3. *Unique Database Constraint*: DB tables (`Order`, `Payment`) enforce `@@unique([idempotencyKey])`. On duplicate request collisions (P2002 error), the system catches the violation, queries the winning row, and returns it cleanly with HTTP `200 OK`.

### 5. Authentication & Token Lifecycle Design (Section 13)
- **Token Dual-Pairing**: Uses short-lived JWT Access Tokens (15 min) for API authorization and long-lived Refresh Tokens (7 days) stored in HttpOnly cookies (`SameSite=None; Secure` in production).
- **Rotation & Reuse Rejection**: Every call to `/api/auth/refresh` revokes the old refresh token, deletes it from the database, and issues a fresh pair. If a revoked or invalid refresh token is presented, the request is immediately rejected (`401 Unauthorized`).
- **Design Tradeoffs**:
  - *Seed Accounts*: Open registration is omitted by design for POS compliance; only pre-provisioned staff accounts (`ADMIN`, `CASHIER`) exist.
  - *Stateless Access Tokens*: Access tokens are verified statelessly via signature for maximum throughput. Revocation occurs when access tokens expire (15 min) or upon refresh token rotation.

---

## 🚀 Production Deployment Instructions

1. **Database Setup (Neon PostgreSQL)**:
   - Create a Neon PostgreSQL project and obtain the connection URI (ensure `?sslmode=require` is present).
2. **Backend Deployment (Render)**:
   - Create a new **Render Web Service** connected to your repository branch.
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && node dist/server.js`
   - Add all required environment variables in the Render dashboard.
   - Open Render Shell and run `npm run seed` once to seed production staff accounts.
3. **Frontend Deployment (Vercel)**:
   - Import the repository root into Vercel and select `frontend/` as the Root Directory.
   - Set environment variable `NEXT_PUBLIC_API_URL` to your deployed Render URL.
   - Vercel automatically detects Next.js build and deploy settings.
4. **CORS Configuration**:
   - Update `CORS_ORIGIN` in Render dashboard to match the production Vercel domain URL.

---

## 📄 Final Audit & Verification

All requirements specified in `instruction.txt` (Sections 1 through 26) have been fully met and verified across unit, integration, concurrency, and end-to-end smoke test suites.
