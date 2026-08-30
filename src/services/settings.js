const db = require('../config/db');

const DEFAULTS = {
  company_name: 'Noor Community Mosque',
  company_address: '',
  company_phone: '',
  company_email: '',
  logo: null,
};

async function get() {
  const row = await db('company_settings').orderBy('id').first();
  return row || { id: null, ...DEFAULTS };
}

async function upsert(data) {
  const existing = await db('company_settings').orderBy('id').first();
  if (existing) {
    await db('company_settings').where({ id: existing.id }).update({ ...data, updated_at: db.fn.now() });
    return existing.id;
  }
  const [row] = await db('company_settings').insert(data).returning('id');
  return row.id || row;
}

module.exports = { get, upsert, DEFAULTS };
