// Authentication & role-based access control middleware.

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

module.exports = { requireAuth, requireRole, canWrite, adminOnly };
