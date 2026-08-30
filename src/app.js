require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const { helmetMiddleware, csrfProtection } = require('./middleware/security');
const { locals } = require('./middleware/locals');

const app = express();

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
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- Sessions (stored in Postgres) ---
app.use(
  session({
    store: new pgSession({
      conObject: { connectionString: process.env.DATABASE_URL },
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

// --- Shared view locals ---
app.use(locals);

// --- Routes ---
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/members', require('./routes/members'));
app.use('/locations', require('./routes/locations'));
app.use('/occupations', require('./routes/occupations'));
app.use('/books', require('./routes/books'));
app.use('/collections', require('./routes/collections'));
app.use('/expenses', require('./routes/expenses'));
app.use('/banks', require('./routes/banks'));
app.use('/reports', require('./routes/reports'));
app.use('/settings', require('./routes/settings'));
app.use('/users', require('./routes/users'));

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
