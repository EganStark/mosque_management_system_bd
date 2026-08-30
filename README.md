# Mosque Management System

A modern, bilingual mosque management platform combining a public-facing website with a comprehensive administration dashboard. It helps mosque teams manage community records, prayer schedules, donations, finance, programs, welfare, staff, assets, documents, governance, and day-to-day operations from one system.

The application supports Bangla and English, responsive desktop/mobile layouts, light and dark themes, role-based access control, auditable financial workflows, and dashboard-controlled public content. The mosque name, identity, contact details, prayer schedule, and website content are configurable for each installation.

## Project status

This repository is an actively developed portfolio and demonstration project. Its current automated verification includes 64 backend integration tests, production environment validation, and a successful TanStack Start production build.

Live demonstration links will be added after the portfolio deployment is complete.

## Highlights

- Public mosque website with prayer and jamaat times, Sahri/Iftar information, prohibited prayer periods, events, programs, announcements, gallery, staff, FAQs, Janaza notices, contact forms, and donation submissions.
- Bilingual Bangla/English experience across the public website and administration dashboard.
- Responsive, theme-aware interface designed for desktop, tablet, and mobile use.
- Role and permission management for administrators, collectors, viewers, and module-specific users.
- Controlled website publishing with drafts, reviews, scheduling, expiry, archives, history, restoration, and readiness checks.
- PostgreSQL-backed sessions, CSRF protection, rate limiting, secure password hashing, and production configuration checks.
- Local storage for development and optional Supabase object storage for public media, private documents, and backups.

## Management modules

### Community and membership

- Member profiles, family information, photos, occupations, references, and address hierarchy
- Membership cards, printable profiles, ledgers, search, filtering, and exports
- Monthly contribution configuration and payment tracking
- Deceased-person and Janaza records
- Public contact and donation inboxes

### Finance and accountability

- Collections, donations, receipt books, pledges, and monthly payments
- Expenses, vouchers, approval controls, and budget enforcement
- Bank accounts, mobile wallets, deposits, withdrawals, and transfers
- Loans, disbursements, repayments, cancellations, and reversals
- Treasury overview, accounting periods, reconciliation, and operational reports
- Welfare, procurement, payroll, and maintenance payment approvals

### Mosque operations

- Prayer timetable and detailed waqt configuration
- Programs, classes, attendance, events, and recurring calendar entries
- Facility bookings and schedules
- Committees, staff operations, meetings, decisions, and action tracking
- Tasks, checklists, templates, recurring tasks, notifications, and dashboard preferences
- Assets, inventory, suppliers, purchase requests, orders, goods receipts, and stock movements
- Documents, reference numbers, templates, archives, and protected attachments
- Data-quality checks, backups, global search, and security audit views

## Technology stack

| Area | Technologies |
|---|---|
| Backend | Node.js, Express, EJS, Knex |
| Database | PostgreSQL |
| Public website | React, TypeScript, TanStack Start, Vite |
| Styling | Tailwind CSS, Bootstrap, custom responsive design |
| Authentication | Express Session, PostgreSQL session store, bcrypt |
| Security | CSRF protection, Helmet, rate limiting, RBAC |
| File storage | Local filesystem or Supabase Storage |
| Testing | Jest, Supertest |
| Optional hosting | Vercel, Render, Supabase, GitHub Actions |

## Architecture

```text
Public website (TanStack Start)
            |
            | JSON API
            v
Express administration and API
       |                 |
       v                 v
PostgreSQL         Local/Supabase Storage
```

The public website reads published content through the Express API. Administrative pages are server-rendered with EJS and protected by authentication, permissions, CSRF validation, and server-side sessions.

## Requirements

- Node.js 20 or 22
- npm
- PostgreSQL 14 or newer

## Local installation

### 1. Clone the repository

```bash
git clone https://github.com/EganStark/mosque_management_system_bd.git
cd mosque_management_system_bd
```

### 2. Configure the backend

```bash
npm install
```

Create the environment file:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Edit `.env` and provide your PostgreSQL connection, strong application secrets, and initial administrator credentials. Never commit `.env`.

### 3. Initialize PostgreSQL

```bash
npm run db:setup
npm run migrate
npm run seed
```

The seed commands are safe to run more than once. The administrator uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values from `.env`.

### 4. Start the administration application

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Start the public website

Open a second terminal:

```bash
cd landing-page
npm install
```

Create `landing-page/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

Then start it:

```bash
npm run dev
```

Open the URL printed by Vite, normally <http://localhost:5173>.

## Important environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection used by the application |
| `SESSION_SECRET` | Long random secret used to sign sessions |
| `CSRF_SECRET` | Long random secret used for CSRF protection |
| `SUBMISSION_HASH_SECRET` | Separate secret for public-submission fingerprints |
| `ADMIN_NAME` | Initial administrator display name |
| `ADMIN_USERNAME` | Initial administrator username |
| `ADMIN_EMAIL` | Initial administrator email |
| `ADMIN_PASSWORD` | Initial administrator password |
| `DEMO_MODE` | Enables the hardened read-only portfolio account when set to `true` |
| `DEMO_USERNAME` | Username that receives full-module read-only demo access |
| `DEMO_PASSWORD` | Separate password for the public demo account |
| `LANDING_PAGE_ORIGIN` | Allowed public website origin or comma-separated origins |
| `LANDING_PAGE_URL` | Public website URL shown inside the dashboard |
| `STORAGE_PROVIDER` | `local` or `supabase` |
| `SUPABASE_URL` | Server-side Supabase project URL when Supabase storage is enabled |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role secret |

See [.env.example](.env.example) for the complete configuration reference.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run the backend with automatic restart |
| `npm start` | Run the backend normally |
| `npm run db:setup` | Create the configured local database |
| `npm run migrate` | Apply pending database migrations |
| `npm run migrate:rollback` | Roll back the latest migration batch |
| `npm run seed` | Seed initial and demonstration configuration |
| `npm run test:db` | Create or verify the isolated test database |
| `npm test` | Run backend integration tests |
| `npm run release:check-env` | Validate production environment settings |
| `npm run release:preflight` | Verify database, migrations, storage, and production readiness |
| `npm run backup:database` | Create a checksummed application-data backup |

Landing-page commands are run from `landing-page/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the public website locally |
| `npm run lint` | Run ESLint |
| `npm run build` | Create the production build |
| `npm run preview` | Preview a completed build |

## Testing

Tests always use an isolated database whose name ends in `_test`.

```bash
npm run test:db
npm test
```

To test the public website:

```bash
cd landing-page
npm run lint
npm run build
```

## Security notes

- Never publish `.env`, database credentials, service-role keys, session secrets, or real administrator passwords.
- Replace all example credentials before exposing the application to the internet.
- Use fictional information in public portfolio deployments; do not upload real member, financial, identity, or welfare records.
- Public demo credentials should belong to a restricted account, never the primary administrator.
- Private documents are authenticated downloads and should use a private storage bucket in hosted environments.
- Run the production environment check and preflight before every release.

## Optional free demo deployment

The repository includes configuration for a portfolio deployment using:

- Vercel for the public website
- Render for the Express administration application
- Supabase for a small demonstration PostgreSQL database and object storage
- GitHub Actions for optional scheduled backups

See [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md) for the deployment walkthrough. Free services have availability, sleep, retention, and usage limitations and should not be treated as production infrastructure.

## Repository structure

```text
landing-page/       React and TanStack Start public website
migrations/         PostgreSQL schema migrations
seeds/              Initial settings and reusable defaults
scripts/            Database, release, and backup utilities
src/
  config/           Database and environment configuration
  middleware/       Authentication, security, governance, and uploads
  public/           Administration assets and local public uploads
  routes/           Administration pages and public API routes
  services/         Business logic and data access
  views/            EJS administration templates
storage/            Local private documents and recovery backups
tests/              Jest and Supertest integration tests
```

## Roadmap

- Resettable fictional demonstration dataset
- Installation-level branding wizard
- Additional automated browser and accessibility tests
- Expanded notification gateway integrations
- Containerized self-hosting option
- Additional documentation and production screenshots

## License

This project is available under the [MIT License](LICENSE).

---

Built as a reusable mosque administration and community-service platform for Bangla- and English-speaking organizations.
