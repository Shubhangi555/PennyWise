# Pennywise — personal expense tracker

React + TypeScript (Vite) frontend, Express + PostgreSQL backend.

## Setup

**Requirements:** Node 20+. PostgreSQL is optional for local development (see below).

```bash
# 1. Database — no install needed: embedded Postgres, data saved in backend/.pgdata
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET (DATABASE_URL already points at the embedded DB)
npm run dev:local         # starts the embedded DB + backend together, serves on :4000

# (or run them separately: `npm run db` in one terminal, `npm run dev` in another)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173 — /api is proxied to :4000
```

To use an installed or hosted PostgreSQL instead, change `DATABASE_URL` in `.env`
(examples in `.env.example`) and use `npm run dev` instead of `npm run dev:local`. To wipe local dev data, stop
`npm run db` and delete `backend/.pgdata`.

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Database migrations

SQL files in `backend/migrations/` run in filename order, each once, in a transaction.
Applied files are recorded in the `schema_migrations` table.

- Runs automatically on server start, or manually with `npm run migrate`.
- To change the schema, **add a new file** (e.g. `003_budgets.sql`). Never edit an applied one.
- Rollback: migrations are forward-only. Write a new migration that reverses the change,
  and take a DB backup (`pg_dump`) before applying anything destructive.

## API

All routes are under `/api`. Everything except `/api/auth/*` and `/api/health` needs
`Authorization: Bearer <token>`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ username, password, displayName? }`. Password 8–72 chars |
| POST | `/api/auth/login` | `{ username, password }`. Rate limited: 20 attempts / 15 min / IP |
| GET | `/api/transactions` | Filters: `from`, `to` (YYYY-MM-DD), `type`, `category_id`, `q` (searches note + category). Paging: `limit` (≤200, default 50), `offset`. Returns `{ items, total, totals: { income, expense } }`, newest first |
| GET | `/api/transactions/export` | Same filters → CSV download (max 50,000 rows) |
| POST | `/api/transactions` | `{ amount, type, category_id, date: 'YYYY-MM-DD', note? }` |
| PUT | `/api/transactions/:id` | Partial update; `note: ""` clears the note |
| DELETE | `/api/transactions/:id` | |
| GET | `/api/categories` | Built-ins + your own, each with `is_custom` |
| POST | `/api/categories` | `{ name, icon?, type }` — your own category |
| PUT | `/api/categories/:id` | `{ name, icon? }` — own categories only; type is fixed |
| DELETE | `/api/categories/:id` | Own categories only; refused (409) while transactions use it |
| GET | `/api/budgets?month=YYYY-MM` | `{ month, items: [{ category_id, name, icon, budget, spent }], total_spent }` |
| PUT | `/api/budgets/:categoryId` | `{ amount }` — set/replace the monthly limit (expense categories) |
| DELETE | `/api/budgets/:categoryId` | |
| GET | `/api/analytics/summary` · `/monthly` · `/by-category` | |
| GET | `/api/health` | Also checks DB connectivity |

## Deploying (Vercel + Render + Neon)

Push the repo to GitHub first. Both Vercel and Render redeploy automatically on every push.

**1. Database: [Neon](https://neon.tech)**: create a project and copy the connection string
(it ends with `?sslmode=require`; keep that).

**2. Backend: [Render](https://render.com) → New → Web Service** → pick the repo:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment variables:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | **new** random value (see command above; don't reuse your local one) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (comma-separate to add a custom domain) |

Migrations run automatically on start. `TRUST_PROXY` defaults to `1` in production, which is
right for Render/Railway. Render's free tier sleeps after 15 min idle; the first request then
takes 30–60 s (the frontend waits up to 60 s).

**3. Frontend: [Vercel](https://vercel.com) → New Project** → same repo:

- Root directory: `frontend` (Vite is auto-detected)
- Environment variable: `VITE_API_URL` = `https://your-backend.onrender.com` (no `/api`)
- `frontend/vercel.json` already handles deep links (`/budgets` on refresh) and security headers.

If you change `VITE_API_URL` later, **redeploy**: it's baked in at build time.

**4. Check:** `https://your-backend.onrender.com/api/health` → `{"status":"ok"}`, then register
on the Vercel URL.

**Rollback:** both dashboards can redeploy a previous build in one click. Migrations are
forward-only, so before deploying a risky schema change create a Neon branch/restore point,
or write a new migration that reverses it.
