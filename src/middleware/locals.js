// Injects shared data into every view: current user, CSRF token, flash messages,
// company settings, Bengali helpers, and the active nav path.
const bn = require('../utils/bn');
const settingsService = require('../services/settings');
const { generateCsrfToken } = require('./security');

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
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
  };
  res.locals.bn = bn;
  res.locals.activePath = req.path;
  try {
    res.locals.csrfToken = generateCsrfToken(req, res);
  } catch (e) {
    res.locals.csrfToken = '';
  }
  try {
    res.locals.company = await getSettings();
  } catch (e) {
    res.locals.company = { company_name: 'বায়তুর রহমান জামে মসজিদ' };
  }
  next();
}

module.exports = { locals, invalidateSettingsCache };
