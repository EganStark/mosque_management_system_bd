require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const db = require('./config/db');
const { validateProductionEnvironment } = require('./config/environment');
const { postgresConnection } = require('./config/postgres-connection');
const { UPLOAD_DIR } = require('./middleware/upload');

const { helmetMiddleware, csrfProtection } = require('./middleware/security');
const { locals } = require('./middleware/locals');
const { permissionGuard, auditLogger } = require('./middleware/governance');
const { refreshAuthenticatedUser } = require('./middleware/auth');
const { demoReadOnly } = require('./middleware/demo-mode');

const app = express();

if (process.env.NODE_ENV === 'production') {
  validateProductionEnvironment(process.env);
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
}

// --- View engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// --- Core middleware ---
app.use(helmetMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Public readiness endpoint for the load balancer. It exposes no credentials
// and returns 503 until PostgreSQL is reachable.
app.get('/healthz', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'ready' });
  } catch (_error) {
    res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

// Machine-to-machine maintenance endpoints use their own bearer secret and
// intentionally run before browser sessions and CSRF middleware.
app.use('/internal', require('./routes/internal'));

// Public API for the landing page. Keep this before session/CSRF middleware so
// cross-origin React requests can read public data and submit public forms.
app.use('/api', require('./routes/api'));

// --- Sessions (stored in Postgres) ---
app.use(
  session({
    store: new pgSession({
      conObject: postgresConnection(),
      tableName: 'session',
      createTableIfMissing: true,
    }),
    name: 'brjm.sid',
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);
app.use(flash());

// --- CSRF (double-submit cookie) ---
app.use(csrfProtection);
app.use(refreshAuthenticatedUser);

// --- Shared view locals ---
app.use(locals);
app.use(demoReadOnly);
app.use(permissionGuard);
app.use(auditLogger);

// --- Routes ---
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/members', require('./routes/members'));
app.use('/deceased', require('./routes/deceased'));
app.use('/management-team', require('./routes/management-team'));
app.use('/assets', require('./routes/assets'));
app.use('/locations', require('./routes/locations'));
app.use('/occupations', require('./routes/occupations'));
app.use('/books', require('./routes/books'));
app.use('/collections', require('./routes/collections'));
app.use('/monthly-payments', require('./routes/monthly-payments'));
app.use('/communications', require('./routes/communications'));
app.use('/programs', require('./routes/programs'));
app.use('/bookings', require('./routes/bookings'));
app.use('/welfare', require('./routes/welfare'));
app.use('/loans', require('./routes/loans'));
app.use('/pledges', require('./routes/pledges'));
app.use('/staff-operations', require('./routes/staff-operations'));
app.use('/maintenance', require('./routes/maintenance'));
app.use('/governance-meetings', require('./routes/governance-meetings'));
app.use('/tasks', require('./routes/tasks'));
app.use('/task-templates', require('./routes/task-templates'));
app.use('/calendar', require('./routes/calendar'));
app.use('/documents', require('./routes/documents'));
app.use('/procurement', require('./routes/procurement'));
app.use('/inventory', require('./routes/inventory'));
app.use('/public-inbox', require('./routes/public-inbox'));
app.use('/expenses', require('./routes/expenses'));
app.use('/banks', require('./routes/banks'));
app.use('/treasury', require('./routes/treasury'));
app.use('/budgets', require('./routes/budgets'));
app.use('/accounting-periods', require('./routes/accounting-periods'));
app.use('/notifications', require('./routes/notifications'));
app.use('/search', require('./routes/search'));
app.use('/workspace', require('./routes/workspace'));
app.use('/data-quality', require('./routes/data-quality'));
app.use('/approvals', require('./routes/approvals'));
app.use('/reports', require('./routes/reports'));
app.use('/settings', require('./routes/settings'));
app.use('/users', require('./routes/users'));
app.use('/security', require('./routes/security'));
app.use('/backups', require('./routes/backups'));
app.use('/landing', require('./routes/landing'));

// --- 404 ---
app.use((req, res) => {
  res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'পেজটি খুঁজে পাওয়া যায়নি।' });
});

// --- Error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    if (req.flash) req.flash('error', 'নিরাপত্তা টোকেন মেলেনি। আবার চেষ্টা করুন।');
    return res.redirect(req.get('Referer') || '/dashboard');
  }
  console.error(err);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: 'ত্রুটি',
    status,
    message: process.env.NODE_ENV === 'production' ? 'একটি সমস্যা হয়েছে।' : err.message,
  });
});

module.exports = app;
