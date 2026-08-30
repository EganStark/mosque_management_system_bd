// Authentication & role-based access control middleware.
const db = require('../config/db');
const { isDemoUser } = require('./demo-mode');

async function refreshAuthenticatedUser(req, res, next) {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser) return next();
  try {
    const user = await db('users')
      .where({ id: sessionUser.id })
      .select('id', 'name', 'username', 'role', 'is_active')
      .first();
    if (user && user.is_active) {
      req.session.user = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      };
      return next();
    }
    return req.session.destroy(() => {
      res.clearCookie('brjm.sid');
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(401).json({ error: 'Account inactive' });
      }
      return res.redirect('/login');
    });
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.session.returnTo = req.originalUrl;
  req.flash('error', 'অনুগ্রহ করে লগইন করুন।');
  return res.redirect('/login');
}

/**
 * Restrict a route to one or more roles.
 * Usage: requireRole('admin') or requireRole(['admin', 'collector'])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'অনুগ্রহ করে লগইন করুন।');
      return res.redirect('/login');
    }
    if (allowed.includes(user.role)) return next();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) && isDemoUser(user)) return next();
    return res.status(403).render('error', {
      title: 'প্রবেশাধিকার নেই',
      status: 403,
      message: 'এই পেজে প্রবেশের অনুমতি আপনার নেই।',
    });
  };
}

/** Convenience: blocks viewers from mutating actions. */
const canWrite = requireRole(['admin', 'collector']);
const adminOnly = requireRole(['admin']);

module.exports = { refreshAuthenticatedUser, requireAuth, requireRole, canWrite, adminOnly };
