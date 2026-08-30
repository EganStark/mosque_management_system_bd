// Security wiring: helmet, CSRF (csrf-csrf), and login rate-limiting.
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

const isProd = process.env.NODE_ENV === 'production';

// Helmet with a relaxed CSP because we load Bootstrap/jQuery/DataTables/Select2 from CDN
// and use inline init scripts. Tighten in a later phase by self-hosting vendor assets.
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'fallback-csrf-secret-change-me',
  cookieName: isProd ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  },
  size: 64,
  // Multipart forms (file uploads) aren't parsed into req.body before this global
  // middleware runs, so those forms pass the token via the action query string.
  // Plain forms send it in the urlencoded body; AJAX may use the header.
  getTokenFromRequest: (req) =>
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.headers['x-csrf-token'],
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
});

module.exports = {
  helmetMiddleware,
  csrfProtection: doubleCsrfProtection,
  generateCsrfToken: generateToken,
  loginLimiter,
};
