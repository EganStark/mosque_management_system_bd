// Injects shared data into every view: current user, CSRF token, flash messages,
// company settings, Bengali helpers, and the active nav path.
const bn = require('../utils/bn');
const settingsService = require('../services/settings');
const { generateCsrfToken } = require('./security');
const notificationsService = require('../services/notifications');
const securityService = require('../services/security');
const approvalsService = require('../services/approvals');
const { isDemoUser } = require('./demo-mode');

let cachedSettings = null;
let cachedAt = 0;
const SETTINGS_TTL = 30 * 1000;

async function getSettings() {
  const now = Date.now();
  if (!cachedSettings || now - cachedAt > SETTINGS_TTL) {
    cachedSettings = await settingsService.get();
    cachedAt = now;
  }
  return cachedSettings;
}

function invalidateSettingsCache() {
  cachedSettings = null;
}

async function locals(req, res, next) {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;
  res.locals.isDemoSession = isDemoUser(res.locals.currentUser);
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
  };
  res.locals.bn = bn;
  res.locals.activePath = req.path;
  res.locals.landingPageUrl = process.env.LANDING_PAGE_URL || process.env.LANDING_PAGE_ORIGIN || 'http://localhost:8080';
  try {
    res.locals.csrfToken = generateCsrfToken(req, res);
  } catch (e) {
    res.locals.csrfToken = '';
  }
  try {
    res.locals.company = await getSettings();
  } catch (e) {
    res.locals.company = { company_name: 'Baitur Rahman Jame Moshjid' };
  }
  res.locals.navNotifications = { items: [], unreadCount: 0, totalCount: 0 };
  res.locals.navCapabilities = {};
  res.locals.navApprovals = { total: 0 };
  if (res.locals.currentUser) {
    try {
      const permissionKeys = securityService.PERMISSIONS.map((item) => item.key);
      const demoSession = isDemoUser(res.locals.currentUser);
      const [notifications, permissionValues] = await Promise.all([
        notificationsService.list(res.locals.currentUser, 4),
        demoSession
          ? Promise.resolve(permissionKeys.map(() => true))
          : Promise.all(permissionKeys.map((permission) =>
            securityService.allowed(res.locals.currentUser.role, permission))),
      ]);
      res.locals.navNotifications = notifications;
      res.locals.navCapabilities = Object.fromEntries(
        permissionKeys.map((permission, index) => [permission, permissionValues[index]]),
      );
      if (res.locals.navCapabilities['system.manage']) {
        res.locals.navApprovals = await approvalsService.summary();
      }
    } catch (_) { /* Navbar must not block page rendering. */ }
  }
  next();
}

module.exports = { locals, invalidateSettingsCache };
