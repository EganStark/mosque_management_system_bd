const db = require('../config/db');
const security = require('../services/security');

const RULES = [
  { test: /^\/members/, permission: 'members.manage' },
  { test: /^\/(collections|expenses|banks|treasury|budgets|accounting-periods|books|occupations|locations)/, permission: 'finance.manage' },
  { test: /^\/monthly-payments/, permission: 'monthly.manage' },
  { test: /^\/communications/, permission: 'monthly.manage' },
  { test: /^\/programs/, permission: 'people.manage' },
  { test: /^\/bookings/, permission: 'people.manage' },
  { test: /^\/welfare/, permission: 'finance.manage' },
  { test: /^\/loans/, permission: 'finance.manage' },
  { test: /^\/pledges/, permission: 'finance.manage' },
  { test: /^\/staff-operations/, permission: 'people.manage' },
  { test: /^\/maintenance/, permission: 'assets.manage' },
  { test: /^\/governance-meetings/, permission: 'people.manage' },
  { test: /^\/tasks/, permission: 'people.manage' },
  { test: /^\/task-templates/, permission: 'people.manage' },
  { test: /^\/calendar/, permission: 'reports.view' },
  { test: /^\/documents/, permission: 'people.manage' },
  { test: /^\/procurement/, permission: 'finance.manage' },
  { test: /^\/inventory/, permission: 'assets.manage' },
  { test: /^\/public-inbox/, permission: 'people.manage' },
  { test: /^\/management-team/, permission: 'people.manage' },
  { test: /^\/assets/, permission: 'assets.manage' },
  { test: /^\/deceased/, permission: 'deceased.manage' },
  { test: /^\/landing/, permission: 'website.manage' },
  { test: /^\/reports/, permission: 'reports.view' },
  { test: /^\/data-quality/, permission: 'reports.view' },
  { test: /^\/(users|settings|security|backups)/, permission: 'system.manage' },
  { test: /^\/approvals/, permission: 'system.manage' },
];

async function permissionGuard(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || req.method === 'OPTIONS') return next();
  const rule = RULES.find((item) => item.test.test(req.path));
  if (!rule || await security.allowed(user.role, rule.permission)) return next();
  db('audit_logs').insert({ user_id: user.id, username: user.username, role: user.role, method: req.method, path: req.originalUrl.split('?')[0], action: 'access_denied', entity: req.path.split('/').filter(Boolean)[0] || 'route', status_code: 403, ip_address: req.ip, user_agent: req.get('user-agent') || null, changes: { required_permission: rule.permission } }).catch((err) => console.error('Authorization audit write failed:', err.message));
  if (req.accepts('json') && !req.accepts('html')) return res.status(403).json({ error: 'Forbidden', permission: rule.permission });
  return res.status(403).render('error', { title: 'অনুমতি নেই', status: 403, message: 'এই কাজটি করার অনুমতি আপনার ভূমিকায় দেওয়া নেই।' });
}

function sanitize(body) {
  const blocked = /password|pass|token|csrf|secret|key|authorization/i;
  const out = {};
  Object.entries(body || {}).forEach(([key, value]) => {
    if (blocked.test(key)) out[key] = '[REDACTED]';
    else if (Buffer.isBuffer(value)) out[key] = '[FILE]';
    else if (Array.isArray(value)) out[key] = value.slice(0, 20);
    else out[key] = typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  });
  return out;
}

function actionFor(req) {
  if (/cancel/i.test(req.path)) return 'cancel';
  if (/delete/i.test(req.path)) return 'delete';
  if (/login/i.test(req.path)) return 'login';
  if (/logout/i.test(req.path)) return 'logout';
  if (req.method === 'POST' && /\/\d+(\/edit)?$/.test(req.path)) return 'update';
  return req.method === 'POST' ? 'create' : req.method.toLowerCase();
}

function auditLogger(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const snapshot = { user_id: user.id, username: user.username, role: user.role, method: req.method, path: req.originalUrl.split('?')[0], action: actionFor(req), entity: req.path.split('/').filter(Boolean)[0] || 'session', entity_id: (req.path.match(/\/(\d+)(?:\/|$)/) || [])[1] || null, ip_address: req.ip, user_agent: req.get('user-agent') || null, changes: sanitize(req.body) };
  res.on('finish', () => {
    db('audit_logs').insert({ ...snapshot, status_code: res.statusCode }).catch((err) => console.error('Audit log write failed:', err.message));
  });
  next();
}

function requirePermission(permission) {
  return async (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/login');
    if (await security.allowed(user.role, permission)) return next();
    db('audit_logs').insert({ user_id: user.id, username: user.username, role: user.role, method: req.method, path: req.originalUrl.split('?')[0], action: 'access_denied', entity: 'landing', status_code: 403, ip_address: req.ip, user_agent: req.get('user-agent') || null, changes: { required_permission: permission } }).catch((err) => console.error('Authorization audit write failed:', err.message));
    return res.status(403).render('error', { title: 'অনুমতি নেই', status: 403, message: 'কনটেন্ট প্রকাশের অনুমতি আপনার নেই। একজন অনুমোদিত প্রকাশকের পর্যালোচনা প্রয়োজন।' });
  };
}

module.exports = { permissionGuard, auditLogger, requirePermission, RULES };
