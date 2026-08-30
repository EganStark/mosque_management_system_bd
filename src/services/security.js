const db = require('../config/db');

const PERMISSIONS = [
  { key: 'members.manage', label: 'সদস্য ব্যবস্থাপনা' }, { key: 'finance.manage', label: 'আদায়, খরচ ও ব্যাংক' },
  { key: 'monthly.manage', label: 'মাসিক চাঁদা' }, { key: 'people.manage', label: 'কমিটি ও স্টাফ' },
  { key: 'assets.manage', label: 'সম্পদ ব্যবস্থাপনা' }, { key: 'deceased.manage', label: 'মরহুম সদস্য' },
  { key: 'website.manage', label: 'ওয়েবসাইট কনটেন্ট সম্পাদনা' }, { key: 'website.publish', label: 'ওয়েবসাইট কনটেন্ট প্রকাশ' }, { key: 'reports.view', label: 'রিপোর্ট দেখা' },
  { key: 'system.manage', label: 'সিস্টেম সেটিংস' },
];
const ROLES = ['admin', 'collector', 'viewer'];

async function matrix() {
  const rows = await db('role_permissions').select('*');
  const result = {};
  ROLES.forEach((role) => { result[role] = {}; PERMISSIONS.forEach((p) => { result[role][p.key] = false; }); });
  rows.forEach((row) => { if (result[row.role]) result[row.role][row.permission] = row.allowed; });
  return result;
}

async function allowed(role, permission) {
  if (role === 'admin') return true;
  const row = await db('role_permissions').where({ role, permission }).first();
  return Boolean(row && row.allowed);
}

async function updateMatrix(body) {
  const roleCaps = {
    collector: new Set(['members.manage', 'finance.manage', 'monthly.manage', 'assets.manage', 'deceased.manage', 'website.manage', 'website.publish', 'reports.view']),
    viewer: new Set(['reports.view']),
  };
  return db.transaction(async (trx) => {
    for (const role of ['collector', 'viewer']) {
      for (const item of PERMISSIONS) {
        const value = roleCaps[role].has(item.key) && body[`${role}:${item.key}`] === 'on';
        await trx('role_permissions').insert({ role, permission: item.key, allowed: value }).onConflict(['role', 'permission']).merge({ allowed: value, updated_at: trx.fn.now() });
      }
    }
  });
}

async function logs({ user_id, action, from, to, limit = 500 } = {}) {
  const q = db('audit_logs').orderBy('created_at', 'desc').limit(limit);
  if (user_id) q.where({ user_id }); if (action) q.where({ action }); if (from) q.where('created_at', '>=', from); if (to) q.where('created_at', '<', db.raw("?::date + INTERVAL '1 day'", [to]));
  return q;
}

module.exports = { PERMISSIONS, ROLES, matrix, allowed, updateMatrix, logs };
