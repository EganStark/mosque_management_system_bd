# বায়তুর রহমান জামে মসজিদ — Admin Panel

A server-rendered admin panel for **Baitur Rahman Jame Mosjid** to manage members, donations/collections, expenses, bank transactions, and produce printable Bengali reports. Built with **Node.js + Express + PostgreSQL**, with a Bengali UI and role-based access (Admin / Collector / Viewer).

This is a clean, secure re-implementation of the system analyzed in [SITE_FUNCTIONALITY_REPORT.md](SITE_FUNCTIONALITY_REPORT.md) (MVP scope — see *Roadmap* below).

---

## Features (MVP)

- **Authentication & roles** — secure login (bcrypt-hashed passwords, sessions in Postgres, CSRF protection, login rate-limiting). Roles: **Admin** (everything), **Collector** (add collections/expenses/bank, manage members), **Viewer** (read-only).
- **Dashboard** — current-month and all-time collection / expense / balance, plus member counts (total / active / male / female). Bengali numerals.
- **Members** — full family-tree profile (member, spouse, parents, repeatable sons/daughters, grandparents), cascading address (Division → District → Thana → Post Office → Village → Area), occupation, reference, photo uploads, monthly-payment settings. Searchable/sortable list with Copy/CSV/Excel/PDF/Print export. Auto-generated member ID.
- **Collections** — record donations (member, book/receipt, amount, purpose, date) + management list.
- **Expenses** — expense heads + expense entries + management list.
- **Bank** — bank accounts, deposit/withdraw, transaction ledger.
- **Administrator settings** — receipt book types & book numbers (receipt ranges, collector, status).
- **Account settings** — occupation + the full location hierarchy (CRUD).
- **Reports** — Collection, Expense, Loss & Profit, Bank Statement (date-range filters, print, Excel export, Bengali headers/numerals).
- **Settings** — company/mosque profile (name, address, phone, email, logo).
- **Users** — user management (Admin only).

---

## Tech Stack

Express · EJS (+ express-ejs-layouts) · PostgreSQL · Knex (migrations/seeds) · express-session + connect-pg-simple · bcryptjs · csrf-csrf · helmet · express-rate-limit · multer · Bootstrap 5 · jQuery DataTables · Select2 · Flatpickr.

---

## Prerequisites

- **Node.js** 18+ (tested on 22)
- **PostgreSQL** 14+ (tested on 18) running locally

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
# then edit .env — set DATABASE_URL (with your postgres password), SESSION_SECRET, CSRF_SECRET, and admin creds

# 3. Create the database (reads DB_NAME / PGADMIN_URL from .env)
npm run db:setup

# 4. Run migrations and seed initial data (admin user, occupations, divisions, company)
npm run migrate
npm run seed

# 5. Start the app
npm run dev      # auto-reload (nodemon)
# or
npm start
```

Then open **http://localhost:3000** and log in with the admin credentials from your `.env`
(`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

> ⚠️ **Change `ADMIN_PASSWORD`, `SESSION_SECRET`, and `CSRF_SECRET`** in `.env` before any real use. Never commit `.env` (it is gitignored).

---

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `SESSION_SECRET` | Session signing secret (long & random) |
| `CSRF_SECRET` | CSRF token secret (long & random) |
| `DATABASE_URL` | Postgres connection string for the app DB |
| `PGADMIN_URL` | Connection to a maintenance DB (`postgres`) used only by `npm run db:setup` |
| `DB_NAME` | Application database name to create |
| `ADMIN_NAME` / `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded super-admin account |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start the server |
| `npm run db:setup` | Create the application database |
| `npm run migrate` | Run latest migrations |
| `npm run migrate:rollback` | Roll back the last migration batch |
| `npm run seed` | Run seeds (idempotent) |
| `npm test` | Run Jest + Supertest smoke tests (uses `baitur_rahman_test` DB) |

**Tests** expect a `baitur_rahman_test` database; create it once with
`createdb baitur_rahman_test` (or via psql) and set `TEST_DATABASE_URL` if your
credentials differ from the default in `tests/setup.js`.

---

## Project structure

```
migrations/            Knex schema migrations
seeds/                 Admin user, occupations, divisions, company defaults
scripts/create-db.js   Creates the app database
src/
  app.js, server.js    Express app + entry
  config/db.js         Knex instance
  middleware/          auth (RBAC), security (helmet/CSRF/rate-limit), upload, locals
  services/            DB query modules (members, collections, expenses, banks, books, locations, reports, users, settings)
  routes/              Route handlers per module
  utils/bn.js          Bengali numerals / money / date helpers
  views/               EJS templates (layout, partials, one folder per module)
  public/              css, js, uploads, vendor assets
tests/                 Jest + Supertest smoke tests
```

---

## Roadmap (future phases)

Deferred from the reference system: SMS (send/templates/history), Letters & printing (cover/letter for dead/all persons), the Mosque Monthly-Payment fund (bill generate, due/yearly reports, fund expenses), Loans & repayment, Due/Pledge list, Committee (members/types/Imam-Speaker), Assets register, and advanced reports (Reference List, Occupation/Group reports, PDF templating).

---

## Security notes

- Passwords are hashed with bcrypt; sessions are stored server-side in Postgres.
- All state-changing requests are CSRF-protected; login is rate-limited.
- File uploads are restricted to images (≤ 4 MB).
- Set strong secrets and run behind HTTPS in production (then set `NODE_ENV=production` so secure cookies are enabled).
