# Free deployment: Vercel + Render + Supabase

This layout keeps the landing page fast and allows the existing Express admin to run without a serverless rewrite.

## 1. Supabase

1. Create a free Supabase project.
2. Copy its PostgreSQL connection string. Prefer the pooler connection string and keep `sslmode=require` enabled.
3. In Storage, create these exact buckets:
   - `public-media` — **public**
   - `private-documents` — **private**
   - `database-backups` — **private**
4. From Project Settings → API, copy the project URL and service-role key. The service-role key is a backend secret and must never be added to the landing page or committed.

## 2. Render backend

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml`.
3. Supply every environment variable marked `sync: false`.
4. Initially set `LANDING_PAGE_ORIGIN` and `LANDING_PAGE_URL` to the Vercel URL after step 3 below, then redeploy.
5. The backend URL will look like `https://mosque-management-admin.onrender.com`.
6. Verify `https://YOUR-RENDER-URL/healthz` returns `{ "status": "ok", "database": "ready" }`.

Use a new administrator password. Do not deploy with `ChangeMe@123`, `Admin@2026`, or `admin`.

For the public portfolio login, also supply unique `DEMO_USERNAME` and `DEMO_PASSWORD` values. `DEMO_MODE=true` creates a dedicated `demo` role with broad read visibility, while the server rejects every state-changing request from that account. Never publish the private administrator credentials.

The Blueprint also sets `DEMO_DATA_ENABLED=true`. Each deployment safely creates or refreshes the same clearly marked fictional members, finances, events, programs, staff, assets, inventory, welfare request, and tasks without duplicating them. Keep this disabled for any real installation.

## 3. Vercel landing page

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `landing-page`.
3. Confirm the framework is **TanStack Start**.
4. Add `VITE_API_URL=https://YOUR-RENDER-URL/api` to Production and Preview environment variables.
5. Deploy and copy the Vercel URL back into Render as both `LANDING_PAGE_ORIGIN` and `LANDING_PAGE_URL`.

## 4. Free scheduled backup

Add these GitHub Actions repository secrets:

- `PRODUCTION_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The workflow `.github/workflows/database-backup.yml` runs daily at 02:30 Asia/Dhaka (20:30 UTC) and can also be run manually. It stores checksummed exports in the private `database-backups` bucket and retains 30 days.

## Free-tier behavior

- Render sleeps after inactivity, so the first backend/API request can be slow.
- Supabase free projects can pause after prolonged inactivity.
- Do not depend on Render's local filesystem; production uploads use Supabase Storage.
- Free tiers have no service-level guarantee. Keep independent downloads of important backups.
