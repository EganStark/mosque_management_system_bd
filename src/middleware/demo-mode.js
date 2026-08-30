const db = require('../config/db');

function enabled(env = process.env) {
  return String(env.DEMO_MODE || '').toLowerCase() === 'true';
}

function isDemoUser(user, env = process.env) {
  const configuredUsername = String(env.DEMO_USERNAME || '').trim().toLowerCase();
  return Boolean(enabled(env) && configuredUsername && user
    && String(user.username || '').toLowerCase() === configuredUsername);
}

function auditBlockedRequest(req) {
  const user = req.session.user;
  return db('audit_logs').insert({
    user_id: user.id,
    username: user.username,
    role: user.role,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    action: 'demo_write_blocked',
    entity: req.path.split('/').filter(Boolean)[0] || 'route',
    status_code: 403,
    ip_address: req.ip,
    user_agent: req.get('user-agent') || null,
    changes: { demo_mode: true },
  }).catch((error) => console.error('Demo-mode audit write failed:', error.message));
}

function demoReadOnly(req, res, next) {
  const user = req.session && req.session.user;
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const isLogout = req.method === 'POST' && req.path === '/logout';
  if (!isDemoUser(user) || safeMethod || isLogout) return next();

  auditBlockedRequest(req);
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(403).json({ error: 'Demo account is read-only', code: 'DEMO_READ_ONLY' });
  }
  return res.status(403).render('error', {
    title: 'Demo mode',
    status: 403,
    message: 'This public demo account is read-only. Sign in with a private administrator account to change data.',
  });
}

module.exports = { enabled, isDemoUser, demoReadOnly };
